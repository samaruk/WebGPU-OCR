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
                           from the outermost pair; ≥ 3 at a regular pitch
                           (a rule under every item row) give the row
                           bands outright and outrank a boxed customer
                           block that would pose as a vertical grid;
          · sections       long horizontal rules outside the table;
          · one frame around the boxed header (address, customer block:
                           three columns) and the item table (a dozen):
                           the rule where the interior verticals change
                           splits it — the part with the most crossings
                           is the table, the rest a boxed block that is
                           not the table (splitGridAtSection);
     3. PRIORS for the column stage: table region and column boundaries.
   ====================================================================== */

const lengthH=r=>r.x1-r.x0+1, lengthV=r=>r.y1-r.y0+1;

/* ---- one frame, two sections ---------------------------------------------------
   An invoice's boxed header (address · INVOICE · logos, then the customer block: three columns) and its item
   table (a dozen columns) often share one outer frame, so their rules meet and the intersection graph makes them
   one grid. They are two sections: a long horizontal rule of the grid where the interior verticals above it and
   below it are different sets (none in common, or one in four at most) splits it. The part with the most rule
   crossings is the table; the other parts are boxed blocks that are not the table.
     splitGridAtSection(hs, vs, box, tolerance) → {parts:[{y0,y1,score}], table:part, splits:[y…]} or null
   hs: the grid's horizontal rules sorted by y (deduped), vs: its verticals sorted by x, box: the grid's box. */
export function splitGridAtSection(hs, vs, box, tolerance){
  if(!hs || hs.length<3 || !vs || vs.length<3) return null;
  const interior=vs.filter(v=>{ const x=xAt(v,(v.y0+v.y1)/2); return x>box.x0+2*tolerance && x<box.x1-2*tolerance; });
  const bandVerts=[];                                            // per band between consecutive rules: the interior verticals spanning it
  for(let i=0;i<hs.length-1;i++){ const y0=hs[i].y, y1=hs[i+1].y;
    bandVerts.push(interior.filter(v=>v.y0<=y0+tolerance && v.y1>=y1-tolerance).map(v=>({v, x:xAt(v,(y0+y1)/2)}))); }
  // a separator both bands share: the same traced rule running through the boundary, or two pieces of one at the
  // same x (a few pixels — the header box's 540 and the table's 520 are two separators, not one)
  const tight=Math.max(3, tolerance/3);
  const shared=(A,B)=>A.filter(a=>B.some(b=>b.v===a.v || Math.abs(a.x-b.x)<=tight)).length;
  const width=box.x1-box.x0;
  const splits=[];
  for(let i=1;i<hs.length-1;i++){
    const A=bandVerts[i-1], B=bandVerts[i]; if(A.length<2 || B.length<2) continue;
    if(lengthH(hs[i])<0.7*width) continue;                       // only a rule across the frame separates sections
    if(shared(A,B)<=0.25*Math.min(A.length,B.length)) splits.push(i);
  }
  if(!splits.length) return null;
  const parts=[]; let start=0;
  for(const i of splits.concat([hs.length-1])){ let score=0; for(let b=start;b<i;b++) score+=bandVerts[b].length; parts.push({y0:hs[start].y, y1:hs[i].y, from:start, to:i, score, bands:i-start}); start=i; }
  const table=parts.slice().sort((a,b)=>b.score-a.score || b.bands-a.bands)[0];
  return {parts, table, splits:splits.map(i=>hs[i].y)};
}
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
  const intersections=[], crossings=[];
  for(let i=0;i<nH;i++){ const h=horizontal[i];
    for(let j=0;j<nV;j++){ const v=vertical[j];
      const vx=xAt(v,h.y), hy=yAt(h,v.x);
      if(vx<h.x0-tolerance || vx>h.x1+tolerance) continue;
      if(hy<v.y0-tolerance || hy>v.y1+tolerance) continue;
      unite(i,nH+j); intersections.push({x:vx,y:hy}); crossings.push(i);
    } }
  const groups=new Map();
  for(let i=0;i<nH+nV;i++){ const r=find(i); if(!groups.has(r)) groups.set(r,{hs:[],vs:[],crossings:0,root:r});
    (i<nH?groups.get(r).hs:groups.get(r).vs).push(i<nH?horizontal[i]:vertical[i-nH]); }
  for(const i of crossings) groups.get(find(i)).crossings++;
  const grids=[...groups.values()].filter(g=>g.hs.length>=2 && g.vs.length>=2);
  for(const g of grids){
    g.box={x0:Math.min(...g.hs.map(h=>h.x0),...g.vs.map(v=>v.x0)), y0:Math.min(...g.hs.map(h=>h.y0),...g.vs.map(v=>v.y0)),
           x1:Math.max(...g.hs.map(h=>h.x1),...g.vs.map(v=>v.x1)), y1:Math.max(...g.hs.map(h=>h.y1),...g.vs.map(v=>v.y1))};
    g.area=(g.box.x1-g.box.x0)*(g.box.y1-g.box.y0);
  }
  // the grid with the most rule CROSSINGS is the printed structure: a boxed
  // title row crosses its separators dozens of times, while a pen line down
  // the page edge meeting a signature underline and a section rule spans a
  // huge box on two crossings
  grids.sort((a,b)=>b.crossings-a.crossings || b.area-a.area);
  const grid=grids[0]||null;
  const inAnyGrid=new Set(); for(const g of grids) for(const h of g.hs) inAnyGrid.add(h);

  // merge rules that lie within tolerance of each other (double lines)
  const dedupe=(arr,key)=>{ const sorted=arr.slice().sort((a,b)=>a[key]-b[key]); const out=[];
    for(const r of sorted){ const prev=out[out.length-1];
      if(prev && Math.abs(r[key]-prev[key])<=tolerance){ if((key==='y'?lengthH(r):lengthV(r))>(key==='y'?lengthH(prev):lengthV(prev))) out[out.length-1]=r; }
      else out.push(r); }
    return out; };

  const layout={kind:'none', table:null, headerBox:null, box:null, colsX:[], rowsY:[], sections:[], grid:null, rowRuled:false, rowPitch:0};
  if(grid){
    let hs=dedupe(grid.hs,'y'), vs=dedupe(grid.vs,'x'), gridBox=grid.box;
    // one frame around the boxed header and the item table: the rule where the column separators change splits
    // them, the part with the most crossings is the table, the rest are boxed blocks that are not the table
    const sp=splitGridAtSection(hs, vs, grid.box, tolerance);
    if(sp && sp.parts.length>1){
      const T=sp.table;
      hs=hs.filter(h=>h.y>=T.y0-tolerance && h.y<=T.y1+tolerance);
      vs=vs.filter(v=>v.y0<=T.y1-tolerance && v.y1>=T.y0+tolerance);
      gridBox={x0:grid.box.x0, y0:T.y0, x1:grid.box.x1, y1:T.y1};
      const others=sp.parts.filter(p=>p!==T);
      layout.box={x0:grid.box.x0, y0:others[0].y0, x1:grid.box.x1, y1:others[others.length-1].y1};
      layout.boxes=others.map(p=>({x0:grid.box.x0, y0:p.y0, x1:grid.box.x1, y1:p.y1}));
      layout.split=sp.splits.slice();
    }
    layout.grid={hs,vs,box:gridBox,intersections};
    const colsX=vs.map(v=>({x:xAt(v,(v.y0+v.y1)/2), y0:v.y0, y1:v.y1}));
    const rowsY=hs.map(h=>({y:h.y, x0:h.x0, x1:h.x1}));
    const boxHeight=gridBox.y1-gridBox.y0;
    // a short grid is a boxed HEADER whatever its rule count: two-line
    // column titles ("Per pack" over "Trade / VAT") add a middle rule and
    // would otherwise pass as a three-rule table that is the header alone
    if(boxHeight<=0.12*H){ layout.kind='header-box'; layout.headerBox={...gridBox}; layout.colsX=colsX; layout.headerRowsY=rowsY; }
    else if(hs.length>=3){ layout.kind='full-grid'; layout.table={...gridBox}; layout.rowsY=rowsY; layout.colsX=colsX; }
    else { layout.kind='vertical-grid'; layout.table={...gridBox}; layout.colsX=colsX; layout.rowsY=rowsY; }
  }
  /* --- stacked long horizontals with no verticals (open table) ----------
     Long horizontals outside the grid, clustered by x-overlap. Two rules
     (header underline + totals line) bound an open table; a rule under
     EVERY item row — three or more at a regular pitch — gives the row
     bands outright, and such a stack outranks a two-rule box: a boxed
     customer block (two horizontals, a few verticals) is not the item
     table, however large it is.                                          */
  const longH=horizontal.filter(h=>h.long && !inAnyGrid.has(h) && !h.isDashed).sort((a,b)=>a.y-b.y);   // rules of ANY grid are structure already
  const stacks=[];                               // cluster by x-overlap ≥ 70 % of the shorter
  for(const h of longH){
    let home=null;
    for(const s of stacks){ const ref=s[0];
      const overlap=Math.min(ref.x1,h.x1)-Math.max(ref.x0,h.x0)+1;
      if(overlap>=0.7*Math.min(lengthH(ref),lengthH(h))){ home=s; break; } }
    if(home) home.push(h); else stacks.push([h]);
  }
  stacks.sort((a,b)=>b.length-a.length);
  const stackAll=stacks[0]?dedupe(stacks[0],'y'):null;
  let stack=stackAll, pitch=0, rowRuled=false;
  // a rule under every row: the longest run of ≥ 4 consecutive rules whose
  // gaps stay within 0.5–2.2 × the stack's median gap (a wrapped name
  // doubles one gap); section rules further apart fall outside the run.
  // Three evenly spaced rules are too little to outrank anything: a
  // header underline with two section rules below can look just like it
  if(stackAll && stackAll.length>=4){
    const gaps=[]; for(let i=1;i<stackAll.length;i++) gaps.push(stackAll[i].y-stackAll[i-1].y);
    const sorted=gaps.slice().sort((a,b)=>a-b); pitch=sorted[Math.floor(sorted.length/2)];
    let bestA=0,bestB=0,cur=0;
    for(let i=1;i<stackAll.length;i++){
      if(gaps[i-1]>=0.5*pitch && gaps[i-1]<=2.2*pitch){ if(i-cur>bestB-bestA){ bestA=cur; bestB=i; } }
      else cur=i;
    }
    if(bestB-bestA+1>=4){ stack=stackAll.slice(bestA,bestB+1); rowRuled=true; }
  }
  // a boxed block above a row-ruled table: the box is the table's own
  // header only when the first ruled row hangs right under it (within
  // 1.5 pitches); otherwise it is a customer / invoice block and is not
  // the table, whatever its size or rule count
  if(rowRuled && grid && (layout.kind==='vertical-grid' || layout.kind==='header-box')){
    const gapBelow=stack[0].y-grid.box.y1;
    const attached=gapBelow>-tolerance && gapBelow<=1.5*pitch;
    if(!attached){
      layout.box={...grid.box};                  // stays on record, but it is not the table
      layout.table=null; layout.headerBox=null; layout.colsX=[]; layout.rowsY=[]; layout.headerRowsY=null; layout.kind='none';
    } else if(layout.kind==='vertical-grid'){    // a boxed title row over ruled item rows
      layout.kind='header-box'; layout.headerBox={...layout.table}; layout.table=null; layout.headerRowsY=layout.rowsY; layout.rowsY=[];
    }
  }
  if(!layout.table){
    if(layout.kind==='header-box'){
      // only rules of the same width as the box (both ends match) can
      // close it; a page-wide section rule below the table does not —
      // with a rule under every row, the ruled run itself closes it
      const hb=layout.headerBox, endTolerance=Math.max(3*tolerance,0.05*(hb.x1-hb.x0));
      const below=(rowRuled ? stack.filter(h=>h.y>hb.y1-tolerance)
        : longH.filter(h=>h.y>hb.y1+tolerance && Math.abs(h.x0-hb.x0)<=endTolerance && Math.abs(h.x1-hb.x1)<=endTolerance)).sort((a,b)=>a.y-b.y);
      if(below.length && rowRuled){ layout.rowRuled=true; layout.rowPitch=pitch; }
      if(below.length){ const bottom=below[below.length-1];
        layout.table={x0:Math.min(hb.x0,bottom.x0), y0:hb.y0, x1:Math.max(hb.x1,bottom.x1), y1:bottom.y1};
        layout.rowsY=[{y:hb.y1,x0:hb.x0,x1:hb.x1}].concat(below.map(h=>({y:h.y,x0:h.x0,x1:h.x1}))); }
    } else if(stack && stack.length>=2){
      const top=stack[0], bottom=stack[stack.length-1];
      layout.kind='row-rules';
      // with a rule under every row the first rule underlines the column
      // titles: the table starts three quarters of a pitch above it
      const y0=rowRuled ? Math.max(0,Math.round(top.y0-0.75*pitch)) : top.y0;
      layout.table={x0:Math.min(top.x0,bottom.x0), y0, x1:Math.max(top.x1,bottom.x1), y1:bottom.y1};
      layout.rowsY=stack.map(h=>({y:h.y,x0:h.x0,x1:h.x1}));
      layout.rowRuled=rowRuled; layout.rowPitch=pitch;
    }
  }
  /* --- section separators: long horizontals not in the table ------------ */
  const inTable=new Set(layout.grid?layout.grid.hs:[]);
  for(const h of horizontal){
    if(inTable.has(h) || h.isDashed) continue;
    if(lengthH(h)<minSection) continue;
    if(layout.table && h.y>=layout.table.y0-tolerance && h.y<=layout.table.y1+tolerance) continue;
    if(layout.headerBox && h.y>=layout.headerBox.y0-tolerance && h.y<=layout.headerBox.y1+tolerance) continue;
    if(layout.box && h.y>layout.box.y0+tolerance && h.y<layout.box.y1-tolerance) continue;   // inside a boxed block: its own rules
    layout.sections.push({y:h.y,x0:h.x0,x1:h.x1});
  }
  for(const y of layout.split||[]) if(!layout.sections.some(s=>Math.abs(s.y-y)<=tolerance)) layout.sections.push({y, x0:layout.grid.box.x0, x1:layout.grid.box.x1, split:true});   // the rule between the boxed header and the table
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
    layout:L.kind, table:box(L.table), headerBox:box(L.headerBox), boxedBlock:box(L.box), rowRuled:!!L.rowRuled,
    columnBoundariesX:L.colsX.map(c=>Math.round(c.x)), rowBoundariesY:L.rowsY.map(r=>Math.round(r.y)),
    sectionsY:L.sections.map(s=>Math.round(s.y)), erasedPixels:B.erasedPixels
  };
}
