/* ======================================================================
   BORDER LAYOUT  ·  what the long rules say about the page, pre text-lines
   Why: many invoices carry printed borders — a full table grid, a boxed
   header row with column separators, an underline under the header and a
   line above the totals, section separators — and people add their own
   with a pen. Those rules are the most reliable layout evidence on the
   page when they exist, and the worst noise for glyph detection when
   they are ignored. This stage runs the rule detector on the rectified
   image before the text-line clean and turns the rules into three things:
     1. an ERASE MASK — every rule's pixels, so the text-line stage never
        sees a rule fused to a glyph;
     2. a LAYOUT — the rules interpreted:
          · full table grid  (≥ 3 horizontal + ≥ 2 vertical rules that
                              intersect): table region, row bands and
                              column boundaries all from borders;
          · vertical grid    (2 horizontal + ≥ 2 vertical): table region
                              and columns from borders, rows from text;
          · header box       (2 close horizontal + ≥ 2 vertical rules,
                              a boxed header row): column boundaries from
                              its separators, extended down over the
                              table body; the band itself comes from text;
          · row rules        (≥ 2 long horizontal rules stacked with no
                              verticals: header underline + totals line):
                              table region from the outermost pair;
          · sections         (long horizontal rules outside the table);
     3. PRIORS for the column stage: forced table region and/or column
        boundaries in image space, which it converts to its de-skewed
        frame.
   ====================================================================== */

const lenH=r=>r.x1-r.x0+1, lenV=r=>r.y1-r.y0+1;
/* y of an h-rule at image column x (polyline has one point per column) */
function yAt(h,x){ const P=h.polyline; if(!P||!P.length) return h.y;
  const i=Math.max(0,Math.min(P.length-1,Math.round(x-P[0].x))); return P[i].y; }
function xAt(v,y){ const P=v.polyline; if(!P||!P.length) return v.x;
  const i=Math.max(0,Math.min(P.length-1,Math.round(y-P[0].y))); return P[i].x; }

/* borders : detectBorders() result on the rectified image
   W,H     : image size
   p       : {brMinLen (fraction of W for a "long" h-rule), brSectionLen}
   binary  : the border binary the rules were traced on (optional). When
             given, the erase mask follows the ACTUAL ink run at every
             column of a rule rather than its mean thickness, so the soft
             fringe of a photographed rule is erased too.                   */
export function analyseBorders(borders,W,H,p,binary=null){
  const hAll=(borders.hLines||[]).slice(), vAll=(borders.vLines||[]).slice();
  const tol=Math.max(6,0.012*Math.max(W,H));
  const minLong=p.brMinLen*W, minSection=(p.brSectionLen||0.5)*W;
  for(const h of hAll) h.long=lenH(h)>=minLong;
  for(const v of vAll) v.long=lenV(v)>=p.brMinLen*H;

  // ---- intersection graph -------------------------------------------
  const nH=hAll.length, nV=vAll.length;
  const par=new Int32Array(nH+nV); for(let i=0;i<par.length;i++) par[i]=i;
  const find=i=>{ while(par[i]!==i){ par[i]=par[par[i]]; i=par[i]; } return i; };
  const uni=(a,b)=>{ a=find(a); b=find(b); if(a!==b) par[a]=b; };
  const hits=[];
  for(let i=0;i<nH;i++){ const h=hAll[i];
    for(let j=0;j<nV;j++){ const v=vAll[j];
      const vx=xAt(v,h.y), hy=yAt(h,v.x);
      if(vx<h.x0-tol || vx>h.x1+tol) continue;
      if(hy<v.y0-tol || hy>v.y1+tol) continue;
      uni(i,nH+j); hits.push({x:vx,y:hy});
    } }
  const comps=new Map();
  for(let i=0;i<nH+nV;i++){ const r=find(i); if(!comps.has(r)) comps.set(r,{hs:[],vs:[]});
    (i<nH?comps.get(r).hs:comps.get(r).vs).push(i<nH?hAll[i]:vAll[i-nH]); }
  const grids=[...comps.values()].filter(c=>c.hs.length>=2 && c.vs.length>=2);
  for(const g of grids){
    g.box={x0:Math.min(...g.hs.map(h=>h.x0),...g.vs.map(v=>v.x0)), y0:Math.min(...g.hs.map(h=>h.y0),...g.vs.map(v=>v.y0)),
           x1:Math.max(...g.hs.map(h=>h.x1),...g.vs.map(v=>v.x1)), y1:Math.max(...g.hs.map(h=>h.y1),...g.vs.map(v=>v.y1))};
    g.area=(g.box.x1-g.box.x0)*(g.box.y1-g.box.y0);
  }
  grids.sort((a,b)=>b.area-a.area);
  const grid=grids[0]||null;

  // merge rules that lie within tol of each other (double lines)
  const dedupe=(arr,key)=>{ const s=arr.slice().sort((a,b)=>a[key]-b[key]); const out=[];
    for(const r of s){ const last=out[out.length-1]; if(last && Math.abs(r[key]-last[key])<=tol){ if((key==='y'?lenH(r):lenV(r))>(key==='y'?lenH(last):lenV(last))) out[out.length-1]=r; } else out.push(r); }
    return out; };

  const layout={kind:'none', table:null, headerBox:null, colsX:[], rowsY:[], sections:[], grid:null};
  if(grid){
    const hs=dedupe(grid.hs,'y'), vs=dedupe(grid.vs,'x');
    layout.grid={hs,vs,box:grid.box,hits};
    const colsX=vs.map(v=>({x:xAt(v,(v.y0+v.y1)/2), y0:v.y0, y1:v.y1}));
    const rowsY=hs.map(h=>({y:h.y, x0:h.x0, x1:h.x1}));
    const boxH=grid.box.y1-grid.box.y0;
    if(hs.length>=3){ layout.kind='full-grid'; layout.table={...grid.box}; layout.rowsY=rowsY; layout.colsX=colsX; }
    else if(boxH<=0.12*H){ layout.kind='header-box'; layout.headerBox={...grid.box}; layout.colsX=colsX; }
    else { layout.kind='vertical-grid'; layout.table={...grid.box}; layout.colsX=colsX; layout.rowsY=rowsY; }
  }
  // ---- stacked long h-rules with no verticals (open table) -------------
  if(!layout.table){
    const used=new Set(grid?grid.hs:[]);
    const longH=hAll.filter(h=>h.long && !used.has(h) && !h.isDashed).sort((a,b)=>a.y-b.y);
    // cluster by x-overlap ≥ 70 % of the shorter
    const groups=[];
    for(const h of longH){
      let home=null;
      for(const g of groups){ const ref=g[0];
        const ov=Math.min(ref.x1,h.x1)-Math.max(ref.x0,h.x0)+1;
        if(ov>=0.7*Math.min(lenH(ref),lenH(h))){ home=g; break; } }
      if(home) home.push(h); else groups.push([h]);
    }
    groups.sort((a,b)=>b.length-a.length);
    const st=groups[0];
    if(layout.kind==='header-box'){
      // header box + any long rule below it that overlaps the box in x
      // (a totals line, a table bottom): the body spans from the box
      // bottom to the lowest such rule
      const hb=layout.headerBox, endTol=Math.max(3*tol,0.05*(hb.x1-hb.x0));
      // only rules of the same width as the box (both ends match) can
      // close it; a page-wide section rule below the table does not
      const below=longH.filter(h=>h.y>hb.y1+tol && Math.abs(h.x0-hb.x0)<=endTol && Math.abs(h.x1-hb.x1)<=endTol).sort((a,b)=>a.y-b.y);
      if(below.length){ const bot=below[below.length-1];
        layout.table={x0:Math.min(hb.x0,bot.x0), y0:hb.y0, x1:Math.max(hb.x1,bot.x1), y1:bot.y1};
        layout.rowsY=[{y:hb.y1,x0:hb.x0,x1:hb.x1}].concat(below.map(h=>({y:h.y,x0:h.x0,x1:h.x1}))); }
    } else if(st && st.length>=2){
      const top=st[0], bot=st[st.length-1];
      layout.kind='row-rules';
      layout.table={x0:Math.min(top.x0,bot.x0), y0:top.y0, x1:Math.max(top.x1,bot.x1), y1:bot.y1};
      layout.rowsY=st.map(h=>({y:h.y,x0:h.x0,x1:h.x1}));
    }
  }
  // ---- section separators: long h-rules not in the table ----------------
  const inTable=new Set(layout.grid?layout.grid.hs:[]);
  for(const h of hAll){
    if(inTable.has(h) || h.isDashed) continue;
    if(lenH(h)<minSection) continue;
    if(layout.table && h.y>=layout.table.y0-tol && h.y<=layout.table.y1+tol) continue;
    if(layout.headerBox && h.y>=layout.headerBox.y0-tol && h.y<=layout.headerBox.y1+tol) continue;
    layout.sections.push({y:h.y,x0:h.x0,x1:h.x1});
  }
  layout.sections.sort((a,b)=>a.y-b.y);

  // ---- erase mask ------------------------------------------------------
  // At every point of a rule's polyline the mask covers at least ±t0 (from
  // the mean thickness) and, when the border binary is available, the
  // whole contiguous ink run through that point plus a 1 px margin, up to
  // a limit so a glyph the rule crosses is not eaten. A photographed rule
  // has a soft fringe wider than its measured core: erasing only the core
  // leaves a dark halo that thresholds into broken dashes, which then
  // fuse with the descenders of the row above and get it rejected.
  const erase=new Uint8Array(W*H);
  const runV=(x,y,t0)=>{                       // vertical run through (x,y)
    const lim=t0+2;                          // fringe only: never follow ink far into a glyph the rule touches
    let a=y,b=y;
    if(binary){ while(a-1>=0 && y-(a-1)<=lim && (y-(a-1)<=t0 || binary[(a-1)*W+x])) a--;
                while(b+1<H && (b+1)-y<=lim && ((b+1)-y<=t0 || binary[(b+1)*W+x])) b++; }
    else { a=y-t0; b=y+t0; }
    // 1 px margin only where the ink run reached beyond the core
    if(a<y-t0) a--; if(b>y+t0) b++;
    for(let yy=Math.max(0,a);yy<=Math.min(H-1,b);yy++) erase[yy*W+x]=1; };
  const runH=(x,y,t0)=>{                       // horizontal run through (x,y)
    const lim=t0+2;                          // fringe only: never follow ink far into a glyph the rule touches
    let a=x,b=x;
    if(binary){ while(a-1>=0 && x-(a-1)<=lim && (x-(a-1)<=t0 || binary[y*W+a-1])) a--;
                while(b+1<W && (b+1)-x<=lim && ((b+1)-x<=t0 || binary[y*W+b+1])) b++; }
    else { a=x-t0; b=x+t0; }
    if(a<x-t0) a--; if(b>x+t0) b++;
    for(let xx=Math.max(0,a);xx<=Math.min(W-1,b);xx++) erase[y*W+xx]=1; };
  // polyline coordinates can be fractional (a rule's representative y is
  // often n.5): they MUST be rounded before indexing, or y*W lands in
  // another column half a page away
  const paintH=h=>{ const t=Math.ceil((h.thickness||2)/2)+1; const P=h.polyline||[];
    if(P.length){ for(const q of P){ const x=Math.round(q.x), y=Math.round(q.y); if(x>=0&&x<W&&y>=0&&y<H) runV(x,y,t); } }
    else { const y=Math.min(H-1,Math.max(0,Math.round(h.y))); for(let x=Math.max(0,Math.round(h.x0));x<=Math.min(W-1,Math.round(h.x1));x++) runV(x,y,t); } };
  const paintV=v=>{ const t=Math.ceil((v.thickness||2)/2)+1; const P=v.polyline||[];
    if(P.length){ for(const q of P){ const x=Math.round(q.x), y=Math.round(q.y); if(x>=0&&x<W&&y>=0&&y<H) runH(x,y,t); } }
    else { const x=Math.min(W-1,Math.max(0,Math.round(v.x))); for(let y=Math.max(0,Math.round(v.y0));y<=Math.min(H-1,Math.round(v.y1));y++) runH(x,y,t); } };
  for(const h of hAll) paintH(h);
  for(const v of vAll) paintV(v);
  let erased=0; for(let i=0;i<erase.length;i++) erased+=erase[i];

  return {hAll, vAll, long:{h:hAll.filter(h=>h.long).length, v:vAll.filter(v=>v.long).length},
          grids:grids.length, layout, erase, erased, tol};
}

/* Paint every rule out of the image: each masked pixel takes the average
   of the nearest unmasked pixels above and below it (a horizontal rule is
   replaced by the paper on either side of it), falling back to left /
   right for vertical rules. Only masked pixels are touched, so glyphs
   away from the rules are bit-identical. Returns {canvas, imageData}.  */
export function inpaintRules(imageData,erase,W,H){
  const src=imageData.data, out=new Uint8ClampedArray(src);
  const R=24;
  const sample=(x,y,dx,dy)=>{ for(let k=1;k<=R;k++){ const xx=x+dx*k, yy=y+dy*k;
    if(xx<0||xx>=W||yy<0||yy>=H) return -1; const j=yy*W+xx; if(!erase[j]) return j; } return -1; };
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=y*W+x; if(!erase[i]) continue;
    let a=sample(x,y,0,-1), b=sample(x,y,0,1);
    if(a<0&&b<0){ a=sample(x,y,-1,0); b=sample(x,y,1,0); }
    if(a<0&&b<0) continue;
    const o=i*4;
    if(a>=0&&b>=0){ for(let c=0;c<3;c++) out[o+c]=(src[a*4+c]+src[b*4+c])>>1; }
    else { const s=(a>=0?a:b)*4; for(let c=0;c<3;c++) out[o+c]=src[s+c]; }
    out[o+3]=255;
  }
  const id=new ImageData(out,W,H);
  const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
  canvas.getContext('2d').putImageData(id,0,0);
  return {canvas, imageData:id};
}

/* JSON summary */
export function bordersToJson(B){
  if(!B) return {detected:false};
  const L=B.layout, ib=b=>b?{x0:Math.round(b.x0),y0:Math.round(b.y0),x1:Math.round(b.x1),y1:Math.round(b.y1)}:null;
  return {
    detected:true, space:'work image', rules:{horizontal:B.hAll.length, vertical:B.vAll.length, longH:B.long.h, longV:B.long.v},
    layout:L.kind, table:ib(L.table), headerBox:ib(L.headerBox),
    columnBoundariesX:L.colsX.map(c=>Math.round(c.x)), rowBoundariesY:L.rowsY.map(r=>Math.round(r.y)),
    sectionsY:L.sections.map(s=>Math.round(s.y)), erasedPixels:B.erased
  };
}
