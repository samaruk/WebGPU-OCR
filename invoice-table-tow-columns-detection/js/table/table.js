/* ======================================================================
   TABLE-LAYOUT ANALYSIS
   Why: the OBBs on their own are an unordered cloud of word boxes, but an
   invoice's value is its structure. This module groups boxes into text
   rows, recovers column gutters from persistent vertical whitespace, and
   separates the line-item table from the header/footer — turning raw
   geometry into a row x column grid.

   This file additionally:
     - detects the column-header row instead of assuming the first row;
     - falls back to word-centre clustering when gutter detection fails;
     - folds wrapped description lines into logical rows;
     - attaches confidence scores to every row, column and the table.
   All of that is purely additive — the layout object keeps every field
   its consumers (render, JSON export) already rely on.
   ====================================================================== */

/* collapse each accepted OBB to an axis-aligned box.  Table analysis runs
   on the *deskewed* pass, where an OBB is already near axis-aligned, so
   the AABB carries essentially the same information at lower cost.       */
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
/* column detection — locate the vertical gutters that separate word
   columns.  cover[x] counts how many rows have a word over column x; a
   gutter is a low-occupancy run.  Scoring by the *fraction of rows* that
   are whitespace — not the longest unbroken whitespace run — is what
   lets a gutter survive being crossed by a wide word, a spanning header
   or a wrapped line.  That crossing-intolerance was the main reason
   adjacent columns merged and columns went missing.  A second soft-split
   pass then separates any columns whose gutter is crossed often enough
   to stay above the hard threshold, by cutting at an occupancy valley.  */
export function detectColumns(rows,medH,sens){
  if(rows.length<2) return [];
  let xLo=1/0,xHi=-1/0;
  for(const r of rows){ if(r.x0<xLo)xLo=r.x0; if(r.x1>xHi)xHi=r.x1; }
  xLo=Math.floor(xLo); xHi=Math.ceil(xHi);
  const W=xHi-xLo+1;
  if(W<8) return [];
  // cover[x] = number of rows with at least one word covering column x
  const cover=new Int32Array(W);
  for(const r of rows){
    const diff=new Int32Array(W+1);
    for(const b of r.boxes){
      const a=Math.max(0,Math.floor(b.x0)-xLo), z=Math.min(W-1,Math.ceil(b.x1)-xLo);
      if(a<=z){ diff[a]++; diff[z+1]--; }
    }
    let run=0;
    for(let x=0;x<W;x++){ run+=diff[x]; if(run>0) cover[x]++; }
  }
  // robust column occupancy = 75th percentile of the non-empty profile
  const nz=[]; for(let x=0;x<W;x++) if(cover[x]>0) nz.push(cover[x]);
  if(nz.length<2) return [];
  nz.sort((a,b)=>a-b);
  const peak=nz[Math.floor(nz.length*0.75)]||1;
  const gMinW=Math.max(3,Math.round(medH*(0.55-0.035*sens)));   // min gutter width
  const gutThr=Math.max(1,Math.round(peak*(0.18+0.03*sens)));   // sens 1..10 → 21%..48% of peak
  // hard gutters — low-occupancy runs wide enough to separate columns
  const gut=[]; let run=-1;
  for(let x=0;x<W;x++){
    if(cover[x]<=gutThr){ if(run<0)run=x; }
    else if(run>=0){ if(x-run>=gMinW) gut.push([run,x-1]); run=-1; }
  }
  if(run>=0 && W-run>=gMinW) gut.push([run,W-1]);
  let segs=[]; let prev=0;                       // column segments lie between gutters
  for(const [g0,g1] of gut){ if(g0>prev) segs.push([prev,g0-1]); prev=g1+1; }
  if(prev<W) segs.push([prev,W-1]);
  segs=splitWideColumns(cover,segs,gMinW);        // recover gutters crossed too often
  const cols=[];
  for(let [a,b] of segs){
    while(a<b && cover[a]===0) a++;               // trim empty padding
    while(b>a && cover[b]===0) b--;
    if(b-a>=Math.round(medH*0.5)) cols.push({x0:a+xLo,x1:b+xLo});
  }
  return cols;
}
/* split a column segment that is really two (or more) columns merged —
   their gutter was crossed too often to drop below the hard threshold.
   A genuine internal gutter shows as an occupancy valley well below the
   segment's own typical level; an edge dip (the ragged side of a right-
   aligned number column) is ignored because it touches a segment end.   */
function splitWideColumns(cover,segs,gMinW){
  const out=[], stack=segs.slice();
  while(stack.length){
    const [a,b]=stack.pop();
    if(b-a+1<2*gMinW){ out.push([a,b]); continue; }
    const vals=[];
    for(let x=a;x<=b;x++) vals.push(cover[x]);
    vals.sort((p,q)=>p-q);
    // reference = the segment's column-level occupancy (75th percentile),
    // so a real gutter still reads as a valley even when the ragged edge
    // of a right-aligned number column drags the median down.
    const ref=vals[Math.floor(vals.length*0.75)]||1;
    const vThr=ref*0.55;
    let best=null,run=-1;
    for(let x=a;x<=b+1;x++){
      if(x<=b && cover[x]<=vThr){ if(run<0)run=x; }
      else {
        if(run>a && x-1<b && (x-run)>=gMinW &&
           (!best || (x-1-run)>(best[1]-best[0]))) best=[run,x-1];
        run=-1;
      }
    }
    if(best){ stack.push([a,best[0]-1]); stack.push([best[1]+1,b]); }
    else out.push([a,b]);
  }
  return out.sort((p,q)=>p[0]-q[0]);
}
/* fallback column detection — used only when the gutter method above
   fails (too few rows, or every candidate gutter gets crossed).  It is a
   different signal entirely: it ignores whitespace and instead clusters
   the word centres themselves.  Words of one column share a centre band;
   a gap wider than ~2x the text height between sorted centres marks a
   real column break.  Robust on sparse invoices where gutters collapse. */
export function columnsByCenters(rows,medH){
  const cx=[];
  for(const r of rows) for(const b of r.boxes) cx.push(b.cx);
  if(cx.length<4) return [];
  cx.sort((a,b)=>a-b);
  const gapThr=medH*2;
  const clusters=[]; let cur=[cx[0]];
  for(let i=1;i<cx.length;i++){
    if(cx[i]-cx[i-1]>gapThr){ clusters.push(cur); cur=[]; }
    cur.push(cx[i]);
  }
  clusters.push(cur);
  const cols=clusters.map(cl=>{
    const lo=cl[0], hi=cl[cl.length-1], mid=(lo+hi)/2;
    const half=Math.max((hi-lo)/2, medH*0.5);
    return {x0:mid-half, x1:mid+half};
  });
  for(let i=1;i<cols.length;i++){            // clip overlaps so columns tile
    if(cols[i].x0<cols[i-1].x1){
      const m=(cols[i-1].x1+cols[i].x0)/2;
      cols[i-1].x1=m; cols[i].x0=m;
    }
  }
  return cols.length>=2 ? cols : [];
}
/* the set of column indices a row has at least one word inside */
export function rowColumns(row,cols){
  const set=new Set();
  for(let c=0;c<cols.length;c++){
    for(const b of row.boxes){
      if(b.x1>=cols[c].x0 && b.x0<=cols[c].x1){ set.add(c); break; }
    }
  }
  return set;
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
/* choose the column-header row instead of assuming it is the first one.
   Geometric heuristic (there is no OCR here): the header labels every
   column, so among the first few table rows it is the one occupying the
   most columns; ties go to the earliest row.  Real header detection
   would also read the text (no numbers, keyword match) — the natural
   next step once an OCR stage exists.                                   */
export function detectHeaderRow(occ){
  const lim=Math.min(3,occ.length);
  let best=0,bestFill=-1;
  for(let i=0;i<lim;i++){
    const f=occ[i].size;
    if(f>bestFill){ bestFill=f; best=i; }
  }
  return bestFill>=2 ? best : 0;
}
/* fold wrapped description lines into logical rows.  A continuation line
   carries only the description column (column 0) and sits directly under
   a fuller row, so it is that row's first cell wrapping onto a new line.
   Text-line rows are kept untouched; this only records which lines form
   one logical table row, so the caller can keep both views.             */
export function buildLogicalRows(occ){
  const logical=[];
  occ.forEach((set,i)=>{
    const descOnly = set.size===1 && set.has(0);
    const prev=logical[logical.length-1];
    if(descOnly && prev && prev.full) prev.rows.push(i);
    else logical.push({rows:[i], full:set.size>=2});
  });
  return logical;
}
export function analyzeTable(pass,p){
  pass.layout=null;
  const empty={medH:1,allRows:[],tRange:[-1,-1],table:null,rows:[],cols:[],
               header:null,footer:null,colHeader:-1,logicalRows:[],tableScore:0};
  const boxes=wordAABBs(pass);
  if(boxes.length<8){ pass.layout=empty; return; }
  const hs=boxes.map(b=>b.h).sort((a,b)=>a-b);
  const medH=hs[hs.length>>1]||1;
  const rows=groupRows(boxes,medH);
  if(rows.length<3){ pass.layout={...empty,medH,allRows:rows}; return; }

  // columns: gutter persistence first, word-centre clustering as fallback
  let cols=detectColumns(rows,medH,p.tableSens);
  if(cols.length<2){
    const byC=columnsByCenters(rows,medH);
    if(byC.length>=2) cols=byC;
  }
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
    const band=rows.slice(bT,bB+1);
    let refined=detectColumns(band,medH,p.tableSens);
    if(refined.length<2){
      const c=columnsByCenters(band,medH);
      if(c.length>=2) refined=c;
    }
    if(refined.length>=2){ cols=refined; [bT,bB]=bandOf(); }
  }
  if(bT<0 || bB-bT+1<3){ pass.layout={...empty,medH,allRows:rows}; return; }

  const tableRows=rows.slice(bT,bB+1);
  const table=unionBox(tableRows);
  const nC=cols.length;
  // per-row column occupancy — drives scores, the header pick and merging
  const occ=tableRows.map(r=>rowColumns(r,cols));
  const colHits=new Array(nC).fill(0);
  occ.forEach(set=>set.forEach(c=>colHits[c]++));

  // row cells tile the table top-to-bottom — no empty gaps between rows.
  // score = fraction of columns the row occupies (0..1).
  const rowCells=tableRows.map((r,i)=>({
    x0:table.x0,
    y0:i===0 ? table.y0 : (tableRows[i-1].y1+r.y0)/2,
    x1:table.x1,
    y1:i===tableRows.length-1 ? table.y1 : (r.y1+tableRows[i+1].y0)/2,
    cy:r.cy, tx0:r.x0, tx1:r.x1,
    score:+(occ[i].size/nC).toFixed(3),
    continuation:false, logical:-1
  }));
  // logical rows — wrapped description lines folded onto the row above.
  // The text-line rowCells above are kept as-is; each is tagged with the
  // logical row it belongs to and whether it is a continuation line.
  const logical=buildLogicalRows(occ);
  logical.forEach((lg,li)=>lg.rows.forEach((ri,k)=>{
    rowCells[ri].logical=li;
    rowCells[ri].continuation = k>0;
  }));
  const logicalRows=logical.map(lg=>{
    const cs=lg.rows.map(ri=>rowCells[ri]);
    return {rows:lg.rows.slice(), head:lg.rows[0], lineCount:lg.rows.length,
            x0:Math.min(...cs.map(c=>c.x0)), y0:Math.min(...cs.map(c=>c.y0)),
            x1:Math.max(...cs.map(c=>c.x1)), y1:Math.max(...cs.map(c=>c.y1))};
  });
  // column cells tile the table left-to-right.
  // score = fraction of table rows that have a word in this column.
  const colCells=cols.map((c,i)=>({
    x0:i===0 ? table.x0 : (cols[i-1].x1+c.x0)/2,
    y0:table.y0,
    x1:i===cols.length-1 ? table.x1 : (c.x1+cols[i+1].x0)/2,
    y1:table.y1,
    score:+(colHits[i]/tableRows.length).toFixed(3)
  }));
  const colHeader=detectHeaderRow(occ);
  // overall table confidence — how full the rows are, how well the
  // columns are supported, discounted for a very small table.
  const meanRow=rowCells.reduce((s,r)=>s+r.score,0)/rowCells.length;
  const meanCol=colCells.reduce((s,c)=>s+c.score,0)/colCells.length;
  const sizeOk=Math.min(1,tableRows.length/4)*Math.min(1,nC/2);
  const tableScore=+((meanRow*0.45+meanCol*0.40+0.15)*sizeOk).toFixed(3);

  pass.layout={
    medH, allRows:rows, tRange:[bT,bB], table,
    rows:rowCells, cols:colCells, colHeader,
    logicalRows, tableScore,
    header: bT>0 ? unionBox(rows.slice(0,bT)) : null,
    footer: bB<rows.length-1 ? unionBox(rows.slice(bB+1)) : null
  };
}
