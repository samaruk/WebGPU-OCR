/* ======================================================================
   TABLE-LAYOUT ANALYSIS
   Why: the OBBs on their own are an unordered cloud of word boxes, but an
   invoice's value is its structure. This module groups boxes into text
   rows, recovers column gutters from persistent vertical whitespace, and
   separates the line-item table from the header/footer — turning raw
   geometry into a row x column grid.
   ====================================================================== */
/* =====================================================================
   TABLE LAYOUT  —  group the after-rotate word boxes into text rows,
   find the column gutters (persistent vertical whitespace), and isolate
   the line-item table from the invoice header and footer.  Border rules
   are already dropped by the non-character filter, so the same gutter
   logic serves bordered and borderless tables alike.
   ===================================================================== */
export function wordAABBs(pass){
  const out=[];
  for(const bl of pass.blobs) for(const pt of bl.parts){
    if(!pt.accepted) continue;
    const c=pt.corners;
    let x0=c[0].x,x1=c[0].x,y0=c[0].y,y1=c[0].y;
    for(let i=1;i<4;i++){const q=c[i];
      if(q.x<x0)x0=q.x; if(q.x>x1)x1=q.x;
      if(q.y<y0)y0=q.y; if(q.y>y1)y1=q.y;}
    out.push({x0,y0,x1,y1,cx:(x0+x1)/2,cy:(y0+y1)/2,w:x1-x0,h:y1-y0});
  }
  return out;
}
export function unionBox(rows){
  let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
  for(const r of rows){
    if(r.x0<x0)x0=r.x0; if(r.y0<y0)y0=r.y0;
    if(r.x1>x1)x1=r.x1; if(r.y1>y1)y1=r.y1;
  }
  return {x0,y0,x1,y1};
}
/* group word boxes into text-line rows.  Coverage bands give the gross
   structure, each band is split into its constituent lines, then over-
   split lines are merged back and phantom rows (an inter-line gap that
   holds no full-height OBB — only descender specks) are dropped, so a
   row is always a real text line and boundaries land in the gaps.      */
export function groupRows(boxes,medH){
  if(!boxes.length) return [];
  let minY=1/0,maxY=-1/0;
  for(const b of boxes){ if(b.y0<minY)minY=b.y0; if(b.y1>maxY)maxY=b.y1; }
  minY=Math.floor(minY); maxY=Math.ceil(maxY);
  const H=maxY-minY+1;
  if(H<2) return [];
  const cover=new Int32Array(H);                 // # word boxes over each scanline
  for(const b of boxes){
    const a=Math.max(0,Math.floor(b.y0)-minY), z=Math.min(H-1,Math.ceil(b.y1)-minY);
    for(let y=a;y<=z;y++) cover[y]++;
  }
  // coverage bands = maximal runs of covered scanlines; a tiny 3px gap
  // is bridged so a barely detached descender speck stays with its line.
  const bands=[]; let s=-1,last=-1;
  for(let y=0;y<H;y++){
    if(cover[y]>0){ if(s<0)s=y; last=y; }
    else if(s>=0 && y-last>3){ bands.push([s,last]); s=-1; }
  }
  if(s>=0) bands.push([s,last]);
  if(!bands.length) return [];
  // single text-line height — median height of the clearly-single bands
  const singles=bands.map(b=>b[1]-b[0]+1).filter(h=>h<=medH*1.7).sort((a,b)=>a-b);
  const lineH=singles.length ? singles[singles.length>>1] : medH*1.25;
  const bandBoxes=bands.map(()=>[]);
  for(const b of boxes){
    const cy=b.cy-minY;
    let bi=0,bd=1/0;
    for(let i=0;i<bands.length;i++){
      const [y0,y1]=bands[i];
      const d=cy<y0?y0-cy:cy>y1?cy-y1:0;
      if(d<bd){bd=d;bi=i;}
    }
    bandBoxes[bi].push(b);
  }
  // a band taller than one line holds several merged text lines — split
  // it into one row per line at the widest centre-to-centre gaps.
  const groups=[];
  bands.forEach(([y0,y1],bi)=>{
    const bb=bandBoxes[bi];
    if(!bb.length) return;
    const n=Math.max(1,Math.round((y1-y0+1)/lineH));
    if(n<=1 || bb.length<=n){ groups.push(bb); return; }
    bb.sort((a,b)=>a.cy-b.cy);
    const gaps=[];
    for(let i=1;i<bb.length;i++) gaps.push([bb[i].cy-bb[i-1].cy,i]);
    gaps.sort((a,b)=>b[0]-a[0]);
    const cut=new Set(gaps.slice(0,n-1).map(g=>g[1]));
    let cur=[bb[0]];
    for(let i=1;i<bb.length;i++){
      if(cut.has(i)){ groups.push(cur); cur=[]; }
      cur.push(bb[i]);
    }
    groups.push(cur);
  });
  const out=groups.filter(g=>g.length).map(g=>{
    let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
    for(const b of g){
      if(b.x0<x0)x0=b.x0; if(b.y0<y0)y0=b.y0;
      if(b.x1>x1)x1=b.x1; if(b.y1>y1)y1=b.y1;
    }
    g.sort((a,b)=>a.x0-b.x0);
    return {boxes:g,x0,y0,x1,y1,cy:(y0+y1)/2};
  });
  out.sort((a,b)=>a.cy-b.cy);
  const bbox=r=>{
    let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
    for(const b of r.boxes){
      if(b.x0<x0)x0=b.x0; if(b.y0<y0)y0=b.y0;
      if(b.x1>x1)x1=b.x1; if(b.y1>y1)y1=b.y1;
    }
    r.x0=x0;r.y0=y0;r.x1=x1;r.y1=y1; r.cy=(y0+y1)/2;
    r.boxes.sort((a,b)=>a.x0-b.x0);
  };
  // a single text line wrongly cut in two leaves two rows sitting on the
  // same scanlines — merge any adjacent rows that overlap vertically
  // (genuine separate lines barely overlap, a bad split overlaps fully).
  for(let i=0;i<out.length-1;){
    const a=out[i],b=out[i+1];
    const ov=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
    const mn=Math.min(a.y1-a.y0,b.y1-b.y0);
    if(ov>0.45*mn){ a.boxes=a.boxes.concat(b.boxes); bbox(a); out.splice(i+1,1); }
    else i++;
  }
  // drop phantom rows — a row holding no full-height OBB is really the
  // empty space between two text lines that only caught descender specks
  // or split slivers.  Dropping it collapses three rows (top·phantom·
  // bottom) into two; the tiled boundary then lands in the gap the
  // phantom row used to occupy — i.e. midway between the two real lines.
  const fullH=0.55*medH;
  const real=out.filter(r=>r.boxes.some(b=>b.h>=fullH));
  return (real.length && real.length<out.length) ? real : out;
}
/* column gutters = vertical bands that stay whitespace through a long
   unbroken run of consecutive rows.  Using the longest run (not a count)
   means a header or footer line that happens to cross the gutter on a
   few rows cannot fill it — the table's own rows still define it.       */
export function detectColumns(rows,medH,sens){
  if(rows.length<2) return [];
  let xLo=1/0,xHi=-1/0;
  for(const r of rows){ if(r.x0<xLo)xLo=r.x0; if(r.x1>xHi)xHi=r.x1; }
  xLo=Math.floor(xLo); xHi=Math.ceil(xHi);
  const W=xHi-xLo+1;
  if(W<8) return [];
  const cur=new Int32Array(W), best=new Int32Array(W);
  for(const r of rows){
    const mark=new Uint8Array(W);
    for(const b of r.boxes){
      const a=Math.max(0,Math.floor(b.x0)-xLo), z=Math.min(W-1,Math.ceil(b.x1)-xLo);
      for(let x=a;x<=z;x++) mark[x]=1;
    }
    for(let x=0;x<W;x++){
      if(mark[x]) cur[x]=0;
      else { const c=++cur[x]; if(c>best[x]) best[x]=c; }
    }
  }
  const runThr=Math.max(4,Math.round(rows.length*0.30));   // gutter whitespace run length
  const gMinW=Math.max(3,Math.round(medH*(0.55-0.035*sens)));   // sens 1..10 → ~0.5..0.2 medH
  const cuts=[]; let run=-1;
  for(let x=0;x<W;x++){
    if(best[x]>=runThr){ if(run<0)run=x; }
    else if(run>=0){ if(x-run>=gMinW) cuts.push([run,x-1]); run=-1; }
  }
  if(run>=0 && W-run>=gMinW) cuts.push([run,W-1]);
  const cols=[]; let prev=0;
  for(const [g0,g1] of cuts){
    if(g0>prev) cols.push({x0:prev+xLo,x1:g0-1+xLo});
    prev=g1+1;
  }
  if(prev<W) cols.push({x0:prev+xLo,x1:W-1+xLo});
  return cols.filter(c=>c.x1-c.x0>=medH*0.5);
}
/* per-row table metrics — columns it fills, and gutters a word spans
   across.  A wide header banner / title spans several gutters; a clean
   table row spans none.                                                */
export function rowMetrics(row,cols,gutters){
  let filled=0;
  for(const c of cols){
    for(const b of row.boxes){
      if(b.x1>=c.x0 && b.x0<=c.x1){ filled++; break; }
    }
  }
  let cross=0;
  for(const g of gutters){
    const m=Math.min(3,(g.x1-g.x0)*0.25);
    for(const b of row.boxes){
      if(b.x0<=g.x0+m && b.x1>=g.x1-m){ cross++; break; }
    }
  }
  return {filled,cross};
}
export function rowValue(row,cols,gutters){
  if(cols.length<2) return -0.45;
  const {filled,cross}=rowMetrics(row,cols,gutters);
  if(cross>=2) return -1.6;                  // spans many columns → header banner / title
  if(filled>=2 && cross===0) return 1.0;     // clean multi-column table row
  if(filled>=3) return 0.7;                  // table row with one spanning word
  return -0.45;                              // sparse row — bridged only inside the table
}
export function analyzeTable(pass,p){
  pass.layout=null;
  const empty={medH:1,allRows:[],tRange:[-1,-1],table:null,rows:[],cols:[],
               header:null,footer:null,colHeader:-1};
  const boxes=wordAABBs(pass);
  if(boxes.length<8){ pass.layout=empty; return; }
  const hs=boxes.map(b=>b.h).sort((a,b)=>a-b);
  const medH=hs[hs.length>>1]||1;
  const rows=groupRows(boxes,medH);
  if(rows.length<3){ pass.layout={...empty,medH,allRows:rows}; return; }

  let cols=detectColumns(rows,medH,p.tableSens);
  // table band = maximum-sum run (Kadane) of graded row values: clean
  // multi-column rows pull the band, a wide header/footer line pushes it
  // away hard, and a sparse row (blank / wrapped description) is bridged
  // only while it is surrounded by genuine table rows.
  const bandOf=()=>{
    const gut=[];
    for(let i=0;i<cols.length-1;i++) gut.push({x0:cols[i].x1,x1:cols[i+1].x0});
    let bSum=-1e9,bT=-1,bB=-1,cSum=0,cS=0; const val=[];
    for(let i=0;i<rows.length;i++){
      const v=rowValue(rows[i],cols,gut); val.push(v);
      if(cSum<=0){ cSum=v; cS=i; } else cSum+=v;
      if(cSum>bSum){ bSum=cSum; bT=cS; bB=i; }
    }
    while(bT>=0 && bT<=bB && val[bT]<=0) bT++;       // begin/end on a real table row
    while(bB>=bT && val[bB]<=0) bB--;
    return [bT,bB];
  };
  let [bT,bB]=bandOf();
  if(bT>=0 && bB-bT+1>=3){                           // sharpen columns from the band, retry
    const refined=detectColumns(rows.slice(bT,bB+1),medH,p.tableSens);
    if(refined.length>=2){ cols=refined; [bT,bB]=bandOf(); }
  }
  if(bT<0 || bB-bT+1<3){ pass.layout={...empty,medH,allRows:rows}; return; }

  const tableRows=rows.slice(bT,bB+1);
  const table=unionBox(tableRows);
  // row cells tile the table top-to-bottom — no empty gaps between rows
  const rowCells=tableRows.map((r,i)=>({
    x0:table.x0,
    y0:i===0 ? table.y0 : (tableRows[i-1].y1+r.y0)/2,
    x1:table.x1,
    y1:i===tableRows.length-1 ? table.y1 : (r.y1+tableRows[i+1].y0)/2,
    cy:r.cy, tx0:r.x0, tx1:r.x1
  }));
  // column cells tile the table left-to-right
  const colCells=cols.map((c,i)=>({
    x0:i===0 ? table.x0 : (cols[i-1].x1+c.x0)/2,
    y0:table.y0,
    x1:i===cols.length-1 ? table.x1 : (c.x1+cols[i+1].x0)/2,
    y1:table.y1
  }));
  pass.layout={
    medH, allRows:rows, tRange:[bT,bB], table,
    rows:rowCells, cols:colCells, colHeader:0,
    header: bT>0 ? unionBox(rows.slice(0,bT)) : null,
    footer: bB<rows.length-1 ? unionBox(rows.slice(bB+1)) : null
  };
}
