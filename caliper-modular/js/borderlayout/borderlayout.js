/* ======================================================================
   BORDER LAYOUT  ·  what the long rules say about the page
   Why: many invoices carry printed borders — a full table grid, a boxed
   header row with column separators, an underline under the header and a
   line above the totals, section separators — and people add their own
   with a pen. Those rules are the most reliable layout evidence on the
   page when they exist, and the worst noise for glyph detection when
   they are ignored. This stage runs on the rectified image before the
   text-line clean and turns the rules into three things:
     1. an ERASE MASK — every rule's pixels, so no later stage sees a rule;
     2. a LAYOUT — the rules interpreted:
          · full-grid      ≥ 3 horizontal + ≥ 2 vertical rules that
                           intersect: table region, row bands and column
                           boundaries all from borders;
          · vertical-grid  2 horizontal + ≥ 2 vertical: region and columns
                           from borders, rows from text;
          · header-box     a SHORT grid (≤ 12 % of the page height,
                           whatever its rule count — two-line column
                           titles add a middle rule): column boundaries
                           from its separators; a rule of the same width
                           below the box (a totals line) closes the body;
          · row-rules      ≥ 2 long horizontals stacked with no verticals
                           (header underline + totals line): table region
                           from the outermost pair;
          · sections       long horizontal rules outside the table;
     3. PRIORS for the column stage: table region and column boundaries.
   ====================================================================== */

const lengthH=r=>r.x1-r.x0+1, lengthV=r=>r.y1-r.y0+1;
/* y of a horizontal rule at image column x (polyline has one point per column) */
function yAt(rule,x){ const P=rule.polyline; if(!P||!P.length) return rule.y;
  const i=Math.max(0,Math.min(P.length-1,Math.round(x-P[0].x))); return P[i].y; }
function xAt(rule,y){ const P=rule.polyline; if(!P||!P.length) return rule.x;
  const i=Math.max(0,Math.min(P.length-1,Math.round(y-P[0].y))); return P[i].x; }

/* rules  : detectBorders() result on the rectified image ({hLines,vLines,debug})
   W,H    : image size
   params : {longRuleFrac, sectionRuleFrac} (fractions of the page width)
   binary : the border binary the rules were traced on (optional). When
            given, the erase mask follows the ACTUAL ink run at every column
            of a rule rather than its mean thickness, so the soft fringe of a
            photographed rule is erased too.
   Returns {horizontalRules, verticalRules, longCounts, gridCount, layout,
            eraseMask, erasedPixels, tolerance}                            */
export function analyseBorders(rules,W,H,params,binary=null){
  const horizontal=(rules.hLines||[]).slice(), vertical=(rules.vLines||[]).slice();
  const tolerance=Math.max(6,0.012*Math.max(W,H));
  const minLong=params.longRuleFrac*W, minSection=(params.sectionRuleFrac||0.5)*W;
  for(const h of horizontal) h.long=lengthH(h)>=minLong;
  for(const v of vertical) v.long=lengthV(v)>=params.longRuleFrac*H;

  /* --- intersection graph → grids ------------------------------------- */
  const nH=horizontal.length, nV=vertical.length;
  const parent=new Int32Array(nH+nV); for(let i=0;i<parent.length;i++) parent[i]=i;
  const find=i=>{ while(parent[i]!==i){ parent[i]=parent[parent[i]]; i=parent[i]; } return i; };
  const unite=(a,b)=>{ a=find(a); b=find(b); if(a!==b) parent[a]=b; };
  const intersections=[];
  for(let i=0;i<nH;i++){ const h=horizontal[i];
    for(let j=0;j<nV;j++){ const v=vertical[j];
      const vx=xAt(v,h.y), hy=yAt(h,v.x);
      if(vx<h.x0-tolerance || vx>h.x1+tolerance) continue;
      if(hy<v.y0-tolerance || hy>v.y1+tolerance) continue;
      unite(i,nH+j); intersections.push({x:vx,y:hy});
    } }
  const groups=new Map();
  for(let i=0;i<nH+nV;i++){ const r=find(i); if(!groups.has(r)) groups.set(r,{hs:[],vs:[]});
    (i<nH?groups.get(r).hs:groups.get(r).vs).push(i<nH?horizontal[i]:vertical[i-nH]); }
  const grids=[...groups.values()].filter(g=>g.hs.length>=2 && g.vs.length>=2);
  for(const g of grids){
    g.box={x0:Math.min(...g.hs.map(h=>h.x0),...g.vs.map(v=>v.x0)), y0:Math.min(...g.hs.map(h=>h.y0),...g.vs.map(v=>v.y0)),
           x1:Math.max(...g.hs.map(h=>h.x1),...g.vs.map(v=>v.x1)), y1:Math.max(...g.hs.map(h=>h.y1),...g.vs.map(v=>v.y1))};
    g.area=(g.box.x1-g.box.x0)*(g.box.y1-g.box.y0);
  }
  grids.sort((a,b)=>b.area-a.area);
  const grid=grids[0]||null;

  // merge rules that lie within tolerance of each other (double lines)
  const dedupe=(arr,key)=>{ const sorted=arr.slice().sort((a,b)=>a[key]-b[key]); const out=[];
    for(const r of sorted){ const prev=out[out.length-1];
      if(prev && Math.abs(r[key]-prev[key])<=tolerance){ if((key==='y'?lengthH(r):lengthV(r))>(key==='y'?lengthH(prev):lengthV(prev))) out[out.length-1]=r; }
      else out.push(r); }
    return out; };

  const layout={kind:'none', table:null, headerBox:null, colsX:[], rowsY:[], sections:[], grid:null};
  if(grid){
    const hs=dedupe(grid.hs,'y'), vs=dedupe(grid.vs,'x');
    layout.grid={hs,vs,box:grid.box,intersections};
    const colsX=vs.map(v=>({x:xAt(v,(v.y0+v.y1)/2), y0:v.y0, y1:v.y1}));
    const rowsY=hs.map(h=>({y:h.y, x0:h.x0, x1:h.x1}));
    const boxHeight=grid.box.y1-grid.box.y0;
    // a short grid is a boxed HEADER whatever its rule count: two-line
    // column titles ("Per pack" over "Trade / VAT") add a middle rule and
    // would otherwise pass as a three-rule table that is the header alone
    if(boxHeight<=0.12*H){ layout.kind='header-box'; layout.headerBox={...grid.box}; layout.colsX=colsX; layout.headerRowsY=rowsY; }
    else if(hs.length>=3){ layout.kind='full-grid'; layout.table={...grid.box}; layout.rowsY=rowsY; layout.colsX=colsX; }
    else { layout.kind='vertical-grid'; layout.table={...grid.box}; layout.colsX=colsX; layout.rowsY=rowsY; }
  }
  /* --- stacked long horizontals with no verticals (open table) ---------- */
  if(!layout.table){
    const inGrid=new Set(grid?grid.hs:[]);
    const longH=horizontal.filter(h=>h.long && !inGrid.has(h) && !h.isDashed).sort((a,b)=>a.y-b.y);
    const stacks=[];                               // cluster by x-overlap ≥ 70 % of the shorter
    for(const h of longH){
      let home=null;
      for(const s of stacks){ const ref=s[0];
        const overlap=Math.min(ref.x1,h.x1)-Math.max(ref.x0,h.x0)+1;
        if(overlap>=0.7*Math.min(lengthH(ref),lengthH(h))){ home=s; break; } }
      if(home) home.push(h); else stacks.push([h]);
    }
    stacks.sort((a,b)=>b.length-a.length);
    const stack=stacks[0];
    if(layout.kind==='header-box'){
      // only rules of the same width as the box (both ends match) can
      // close it; a page-wide section rule below the table does not
      const hb=layout.headerBox, endTolerance=Math.max(3*tolerance,0.05*(hb.x1-hb.x0));
      const below=longH.filter(h=>h.y>hb.y1+tolerance && Math.abs(h.x0-hb.x0)<=endTolerance && Math.abs(h.x1-hb.x1)<=endTolerance).sort((a,b)=>a.y-b.y);
      if(below.length){ const bottom=below[below.length-1];
        layout.table={x0:Math.min(hb.x0,bottom.x0), y0:hb.y0, x1:Math.max(hb.x1,bottom.x1), y1:bottom.y1};
        layout.rowsY=[{y:hb.y1,x0:hb.x0,x1:hb.x1}].concat(below.map(h=>({y:h.y,x0:h.x0,x1:h.x1}))); }
    } else if(stack && stack.length>=2){
      const top=stack[0], bottom=stack[stack.length-1];
      layout.kind='row-rules';
      layout.table={x0:Math.min(top.x0,bottom.x0), y0:top.y0, x1:Math.max(top.x1,bottom.x1), y1:bottom.y1};
      layout.rowsY=stack.map(h=>({y:h.y,x0:h.x0,x1:h.x1}));
    }
  }
  /* --- section separators: long horizontals not in the table ------------ */
  const inTable=new Set(layout.grid?layout.grid.hs:[]);
  for(const h of horizontal){
    if(inTable.has(h) || h.isDashed) continue;
    if(lengthH(h)<minSection) continue;
    if(layout.table && h.y>=layout.table.y0-tolerance && h.y<=layout.table.y1+tolerance) continue;
    if(layout.headerBox && h.y>=layout.headerBox.y0-tolerance && h.y<=layout.headerBox.y1+tolerance) continue;
    layout.sections.push({y:h.y,x0:h.x0,x1:h.x1});
  }
  layout.sections.sort((a,b)=>a.y-b.y);

  /* --- erase mask --------------------------------------------------------
     At every point of a rule's polyline the mask covers at least ±core
     (from the mean thickness) and, when the border binary is available,
     the contiguous ink run through that point up to 2 px beyond the core
     — the soft fringe of a photographed rule — with a 1 px margin where
     the run extended. Polyline coordinates can be fractional and MUST be
     rounded before indexing, or y*W lands in another column.            */
  const eraseMask=new Uint8Array(W*H);
  const verticalRun=(x,y,core)=>{
    const limit=core+2; let a=y,b=y;
    if(binary){ while(a-1>=0 && y-(a-1)<=limit && (y-(a-1)<=core || binary[(a-1)*W+x])) a--;
                while(b+1<H && (b+1)-y<=limit && ((b+1)-y<=core || binary[(b+1)*W+x])) b++; }
    else { a=y-core; b=y+core; }
    if(a<y-core) a--; if(b>y+core) b++;
    for(let yy=Math.max(0,a);yy<=Math.min(H-1,b);yy++) eraseMask[yy*W+x]=1; };
  const horizontalRun=(x,y,core)=>{
    const limit=core+2; let a=x,b=x;
    if(binary){ while(a-1>=0 && x-(a-1)<=limit && (x-(a-1)<=core || binary[y*W+a-1])) a--;
                while(b+1<W && (b+1)-x<=limit && ((b+1)-x<=core || binary[y*W+b+1])) b++; }
    else { a=x-core; b=x+core; }
    if(a<x-core) a--; if(b>x+core) b++;
    for(let xx=Math.max(0,a);xx<=Math.min(W-1,b);xx++) eraseMask[y*W+xx]=1; };
  for(const h of horizontal){ const core=Math.ceil((h.thickness||2)/2)+1; const P=h.polyline||[];
    if(P.length){ for(const q of P){ const x=Math.round(q.x), y=Math.round(q.y); if(x>=0&&x<W&&y>=0&&y<H) verticalRun(x,y,core); } }
    else { const y=Math.min(H-1,Math.max(0,Math.round(h.y))); for(let x=Math.max(0,Math.round(h.x0));x<=Math.min(W-1,Math.round(h.x1));x++) verticalRun(x,y,core); } }
  for(const v of vertical){ const core=Math.ceil((v.thickness||2)/2)+1; const P=v.polyline||[];
    if(P.length){ for(const q of P){ const x=Math.round(q.x), y=Math.round(q.y); if(x>=0&&x<W&&y>=0&&y<H) horizontalRun(x,y,core); } }
    else { const x=Math.min(W-1,Math.max(0,Math.round(v.x))); for(let y=Math.max(0,Math.round(v.y0));y<=Math.min(H-1,Math.round(v.y1));y++) horizontalRun(x,y,core); } }
  let erasedPixels=0; for(let i=0;i<eraseMask.length;i++) erasedPixels+=eraseMask[i];

  return {horizontalRules:horizontal, verticalRules:vertical,
          longCounts:{h:horizontal.filter(h=>h.long).length, v:vertical.filter(v=>v.long).length},
          gridCount:grids.length, layout, eraseMask, erasedPixels, tolerance};
}

/* Paint every rule out of the image: each masked pixel takes the average
   of the nearest unmasked pixels above and below it (a horizontal rule is
   replaced by the paper on either side of it), falling back to left /
   right for vertical rules. Only masked pixels are touched.
   Returns {canvas, imageData}.                                           */
export function inpaintRules(imageData,eraseMask,W,H){
  const src=imageData.data, out=new Uint8ClampedArray(src);
  const reach=24;
  const sample=(x,y,dx,dy)=>{ for(let k=1;k<=reach;k++){ const xx=x+dx*k, yy=y+dy*k;
    if(xx<0||xx>=W||yy<0||yy>=H) return -1; const j=yy*W+xx; if(!eraseMask[j]) return j; } return -1; };
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=y*W+x; if(!eraseMask[i]) continue;
    let a=sample(x,y,0,-1), b=sample(x,y,0,1);
    if(a<0&&b<0){ a=sample(x,y,-1,0); b=sample(x,y,1,0); }
    if(a<0&&b<0) continue;
    const o=i*4;
    if(a>=0&&b>=0){ for(let c=0;c<3;c++) out[o+c]=(src[a*4+c]+src[b*4+c])>>1; }
    else { const s=(a>=0?a:b)*4; for(let c=0;c<3;c++) out[o+c]=src[s+c]; }
    out[o+3]=255;
  }
  const result=new ImageData(out,W,H);
  const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
  canvas.getContext('2d').putImageData(result,0,0);
  return {canvas, imageData:result};
}

/* JSON summary */
export function bordersToJson(B){
  if(!B) return {detected:false};
  const L=B.layout, box=b=>b?{x0:Math.round(b.x0),y0:Math.round(b.y0),x1:Math.round(b.x1),y1:Math.round(b.y1)}:null;
  return {
    detected:true,
    rules:{horizontal:B.horizontalRules.length, vertical:B.verticalRules.length, longH:B.longCounts.h, longV:B.longCounts.v},
    layout:L.kind, table:box(L.table), headerBox:box(L.headerBox),
    columnBoundariesX:L.colsX.map(c=>Math.round(c.x)), rowBoundariesY:L.rowsY.map(r=>Math.round(r.y)),
    sectionsY:L.sections.map(s=>Math.round(s.y)), erasedPixels:B.erasedPixels
  };
}
