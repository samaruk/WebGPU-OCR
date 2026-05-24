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
import { S } from '../state/state.js';

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

/* Rows from Pass B blobs.  Pass B uses horizontal-only dilation
   (rowDilH on x, 0 on y), so each accepted blob is one full text-line.
   Returns row objects shaped the way the table-layout helpers expect:
   x0/y0/x1/y1/cy and a single-box .boxes array carrying the AABB
   itself.  Sorted top-to-bottom. */
/* ----------------------------------------------------------------------
   Convert Pass B blobs into row objects.

   Pass B applies HORIZONTAL-only dilation (rowDilH on x, 0 on y), so
   every accepted blob is one entire text-line — characters and words
   within a line are fused into a single connected component, while
   stacked lines remain separate.  Each blob is therefore one row.

   The returned row objects match the shape expected by the rest of the
   table machinery: {x0, y0, x1, y1, cy, boxes:[…]}.  The single-element
   `boxes` array carries the row's own AABB so consumers that still walk
   `row.boxes` (rowColumns, rowMetrics, etc.) continue to work.

   Rows are sorted top-to-bottom by their vertical centre.
   ---------------------------------------------------------------------- */
export function rowsFromPassB(passB){
  if(!passB || !passB.blobs) return [];

  // --- gather candidate rows from every Pass B blob -----------------
  // We deliberately do NOT filter by blob.accepted here.  Pass B is
  // run with rmNon:false in the pipeline so every blob is "accepted",
  // but even if rmNon were on, a real text-line has aspect ≈ 20–50 and
  // would be rejected as "non-character" — the exact opposite of what
  // we want.  Shape-based filtering happens below instead.
  const candidateRows = [];
  for(const blob of passB.blobs){
    const obbCorners = blob.obb && blob.obb.corners;
    let minX, minY, maxX, maxY;
    if(obbCorners){
      minX = maxX = obbCorners[0].x;
      minY = maxY = obbCorners[0].y;
      for(let i = 1; i < 4; i++){
        if(obbCorners[i].x < minX) minX = obbCorners[i].x;
        if(obbCorners[i].x > maxX) maxX = obbCorners[i].x;
        if(obbCorners[i].y < minY) minY = obbCorners[i].y;
        if(obbCorners[i].y > maxY) maxY = obbCorners[i].y;
      }
    } else {
      minX = blob.bb.x0; maxX = blob.bb.x1;
      minY = blob.bb.y0; maxY = blob.bb.y1;
    }
    const blobWidth  = maxX - minX;
    const blobHeight = maxY - minY;

    /* ---- shape filter: ROW must be wider than it is tall, and at
       least 4 px tall (rejects 1-pixel dilation-strip noise). */
    if(blobHeight < 4)               continue;
    if(blobWidth  < blobHeight * 2)  continue;

    candidateRows.push({
      x0: minX, y0: minY, x1: maxX, y1: maxY,
      cy: (minY + maxY) / 2,
      width: blobWidth, height: blobHeight,
      boxes: [{
        x0: minX, y0: minY, x1: maxX, y1: maxY,
        cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
        w: blobWidth, h: blobHeight
      }]
    });
  }
  if(candidateRows.length < 2) return candidateRows;

  // --- median-size filter -------------------------------------------
  // Keep rows whose width is at least 30% of the median width.  This
  // wipes out noise stragglers (lonely speckle that managed to clear
  // the shape filter) while keeping legitimately short rows like a
  // single column header or a one-word footer line.
  const widthList   = candidateRows.map(r => r.width).sort((a, b) => a - b);
  const medianWidth = widthList[widthList.length >> 1] || 10;
  const minRowWidth = Math.max(20, medianWidth * 0.3);

  return candidateRows
    .filter(r => r.width >= minRowWidth)
    .sort((a, b) => a.cy - b.cy);
}


/* ----------------------------------------------------------------------
   Convert Pass C blobs into column boundaries.

   Pass C applies VERTICAL-only dilation (0 on x, colDilV on y), so each
   accepted blob is one column-stripe — every text-line vertically
   stacked in the same column is fused into one component, while side-
   by-side columns stay separate.  Each blob's x-extent is therefore one
   column boundary.

   Page-wide spanners (a title, a "Total" rule, a horizontal line drawn
   under the whole table) end up as a single very wide stripe that
   horizontally overlaps every real column.  If we kept them as columns,
   the table layout would collapse to one giant cell, so we filter them
   out: a stripe wider than 4× the median stripe width is treated as a
   banner and excluded.

   Columns are sorted left-to-right.
   ---------------------------------------------------------------------- */
export function columnsFromPassC(passC){
  if(!passC || !passC.blobs) return [];

  // --- gather candidate column-stripes -----------------------------
  // As with rowsFromPassB we ignore blob.accepted (Pass C is run with
  // rmNon:false) and apply column-shape filtering directly.
  const candidateStripes = [];
  for(const blob of passC.blobs){
    const obbCorners = blob.obb && blob.obb.corners;
    let minX, maxX, minY, maxY;
    if(obbCorners){
      minX = maxX = obbCorners[0].x;
      minY = maxY = obbCorners[0].y;
      for(let i = 1; i < 4; i++){
        if(obbCorners[i].x < minX) minX = obbCorners[i].x;
        if(obbCorners[i].x > maxX) maxX = obbCorners[i].x;
        if(obbCorners[i].y < minY) minY = obbCorners[i].y;
        if(obbCorners[i].y > maxY) maxY = obbCorners[i].y;
      }
    } else {
      minX = blob.bb.x0; maxX = blob.bb.x1;
      minY = blob.bb.y0; maxY = blob.bb.y1;
    }
    const stripeWidth  = maxX - minX;
    const stripeHeight = maxY - minY;

    /* ---- shape filter: COLUMN must be taller than it is wide, and
       at least 4 px wide (rejects 1-pixel dilation-strip noise). */
    if(stripeWidth  < 4)                 continue;
    if(stripeHeight < stripeWidth * 2)   continue;

    candidateStripes.push({
      x0: minX, x1: maxX,
      y0: minY, y1: maxY,
      width: stripeWidth, height: stripeHeight
    });
  }
  if(candidateStripes.length < 2) return [];

  // --- banner filter ------------------------------------------------
  // A title / total-rule that spans the page horizontally still ends up
  // as a single very-wide stripe.  If we kept it, every real column
  // would x-overlap with it and the layout would collapse to one cell.
  const sortedWidths      = candidateStripes.map(s => s.width).sort((a, b) => a - b);
  const medianStripeWidth = sortedWidths[sortedWidths.length >> 1] || 10;
  const bannerWidthLimit  = 4 * medianStripeWidth;

  // --- median-size filter ------------------------------------------
  // Drop very short stripes (height < 30% of median).  A real column
  // spans multiple rows; a tiny stripe is noise or a stray glyph.
  const sortedHeights      = candidateStripes.map(s => s.height).sort((a, b) => a - b);
  const medianStripeHeight = sortedHeights[sortedHeights.length >> 1] || 10;
  const minStripeHeight    = Math.max(20, medianStripeHeight * 0.3);

  return candidateStripes
    .filter(s => s.width  <= bannerWidthLimit)
    .filter(s => s.height >= minStripeHeight)
    .sort((a, b) => a.x0 - b.x0)
    .map(s => ({ x0: s.x0, x1: s.x1 }));
}


/* ----------------------------------------------------------------------
   Per-row column occupancy, derived from the raw Sauvola binary.

   With Pass B's blobs being line-level, the row's AABB covers the full
   width of the row — the legacy `rowColumns(row, cols)` would report
   every column as "filled" because the row's single big box overlaps
   every column horizontally.  That isn't useful information for table
   detection.

   Instead, look inside the (row.y-range × col.x-range) rectangle of the
   un-dilated binary.  If enough ink pixels are present, that cell of
   the row × column grid really has text in it.

   "Enough" is set generously low to catch a single thin column number
   while still ignoring stray Sauvola speckle: at least 4 ink pixels OR
   at least 0.5% of the cell area, whichever is larger.

   Returns a Set of column indices the row has ink in.
   ---------------------------------------------------------------------- */
export function rowColumnsByInk(binary, imageWidth, row, cols){
  const occupiedColumnIndices = new Set();
  const topY                  = Math.max(0, Math.floor(row.y0));
  const bottomY               = Math.floor(row.y1);

  for(let colIdx = 0; colIdx < cols.length; colIdx++){
    const leftX  = Math.max(0, Math.floor(cols[colIdx].x0));
    const rightX = Math.floor(cols[colIdx].x1);
    if(rightX <= leftX || bottomY <= topY) continue;

    const cellArea     = (rightX - leftX + 1) * (bottomY - topY + 1);
    const inkThreshold = Math.max(4, Math.round(cellArea * 0.005));

    // Early-exit scan: stop the moment we've seen enough ink.
    let inkCount = 0;
    outer: for(let y = topY; y <= bottomY; y++){
      const rowOffset = y * imageWidth;
      for(let x = leftX; x <= rightX; x++){
        if(binary[rowOffset + x]){
          inkCount++;
          if(inkCount >= inkThreshold){
            occupiedColumnIndices.add(colIdx);
            break outer;
          }
        }
      }
    }
  }
  return occupiedColumnIndices;
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
/* ----- RLSA directional-dilation row / column detection ------------------
   An opt-in alternative to the projection-based groupRows/detectColumns:
   the Run-Length Smoothing Algorithm. Word boxes are union-found into row
   blobs by horizontal proximity (a gap within dilH, with vertical overlap)
   and into column blobs by vertical proximity (a gap within dilV, with
   horizontal overlap) — a pure directional smear. The dilation reach is
   user-tunable: rows need a wide horizontal reach to bridge the column
   gutters, columns a small vertical one to bridge line spacing. RLSA is
   tolerant of gutter-crossing words but fragments on empty cells, so it is
   an opt-in mode, not the default — the tuning knobs are the user's. */
function ufRoots(n){
  const par=Array.from({length:n},(_,i)=>i);
  const find=i=>{ while(par[i]!==i){ par[i]=par[par[i]]; i=par[i]; } return i; };
  return {find, join:(a,b)=>{ a=find(a); b=find(b); if(a!==b) par[a]=b; }};
}
function ufGroups(items,find){
  const g=new Map();
  for(let i=0;i<items.length;i++){
    const r=find(i); if(!g.has(r)) g.set(r,[]); g.get(r).push(items[i]);
  }
  return [...g.values()];
}
export function rlsaRows(boxes,dilH){
  const n=boxes.length; if(!n) return [];
  const bs=boxes.slice().sort((a,b)=>a.y0-b.y0);   // sorted for an early break
  const uf=ufRoots(n);
  for(let i=0;i<n;i++){
    const A=bs[i];
    for(let j=i+1;j<n;j++){
      const B=bs[j];
      if(B.y0>=A.y1) break;                        // sorted by y0 → no more vertical overlap
      if(Math.max(A.x0,B.x0)-Math.min(A.x1,B.x1) <= dilH) uf.join(i,j);
    }
  }
  const out=ufGroups(bs,uf.find).map(g=>{
    let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
    for(const b of g){ if(b.x0<x0)x0=b.x0; if(b.y0<y0)y0=b.y0; if(b.x1>x1)x1=b.x1; if(b.y1>y1)y1=b.y1; }
    g.sort((a,b)=>a.x0-b.x0);
    return {boxes:g,x0,y0,x1,y1,cy:(y0+y1)/2};
  });
  return out.sort((a,b)=>a.cy-b.cy);
}
export function rlsaColumns(rows,dilV){
  const boxes=[];
  for(const r of rows) for(const b of r.boxes) boxes.push(b);
  if(!boxes.length) return [];
  // Exclude page-width spanners (titles, "BILL TO" lines, totals rules)
  // before union-finding. A box whose width is far above the median
  // word width is almost certainly a header that horizontally overlaps
  // every column — keeping it would union all columns into one group
  // and we would return a single "column" (the "no multi-column found"
  // failure when RLSA is on).
  const ws=boxes.map(b=>b.x1-b.x0).sort((a,b)=>a-b);
  const medW=ws[ws.length>>1]||10;
  const bs=boxes.filter(b => (b.x1-b.x0) <= 4*medW)
                .sort((a,b)=>a.x0-b.x0);
  const n=bs.length; if(!n) return [];
  const uf=ufRoots(n);
  for(let i=0;i<n;i++){
    const A=bs[i];
    for(let j=i+1;j<n;j++){
      const B=bs[j];
      if(B.x0>=A.x1) break;                        // sorted by x0 → no more horizontal overlap
      if(Math.max(A.y0,B.y0)-Math.min(A.y1,B.y1) <= dilV) uf.join(i,j);
    }
  }
  const out=ufGroups(bs,uf.find).map(g=>{
    let x0=1/0,x1=-1/0;
    for(const b of g){ if(b.x0<x0)x0=b.x0; if(b.x1>x1)x1=b.x1; }
    return {x0,x1};
  });
  return out.sort((a,b)=>a.x0-b.x0);
}

/* Assemble the final layout object from row-grouping + column boundaries
   + band indices.  Called by analyzeTable (pass-based), the heuristic
   path and analyzeTableFromBorders so they produce structurally
   identical outputs — rows/cols/header/footer/colCells/logicalRows/
   tableScore.  occFull (optional) is a precomputed row→column occupancy
   array indexed over the full rows[] — when present it is sliced to the
   table band; when absent it is computed from row.boxes via
   rowColumns (legacy AABB-based mode). */
function buildLayout(rows, cols, bT, bB, medH, diag, occFull){
  const tableRows=rows.slice(bT,bB+1);
  const table=unionBox(tableRows);
  const nC=cols.length;
  const occ = occFull
    ? occFull.slice(bT,bB+1)
    : tableRows.map(r=>rowColumns(r,cols));
  const colHits=new Array(nC).fill(0);
  occ.forEach(set=>set.forEach(c=>colHits[c]++));

  const rowCells=tableRows.map((r,i)=>({
    x0:table.x0,
    y0:i===0 ? table.y0 : (tableRows[i-1].y1+r.y0)/2,
    x1:table.x1,
    y1:i===tableRows.length-1 ? table.y1 : (r.y1+tableRows[i+1].y0)/2,
    cy:r.cy, tx0:r.x0, tx1:r.x1,
    score:+(occ[i].size/nC).toFixed(3),
    continuation:false, logical:-1
  }));
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
  const colCells=cols.map((c,i)=>({
    x0:i===0 ? table.x0 : (cols[i-1].x1+c.x0)/2,
    y0:table.y0,
    x1:i===cols.length-1 ? table.x1 : (c.x1+cols[i+1].x0)/2,
    y1:table.y1,
    score:+(colHits[i]/tableRows.length).toFixed(3)
  }));
  const colHeader=detectHeaderRow(occ);
  const meanRow=rowCells.reduce((s,r)=>s+r.score,0)/rowCells.length;
  const meanCol=colCells.reduce((s,c)=>s+c.score,0)/colCells.length;
  const sizeOk=Math.min(1,tableRows.length/4)*Math.min(1,nC/2);
  const tableScore=+((meanRow*0.45+meanCol*0.40+0.15)*sizeOk).toFixed(3);

  return {
    medH, allRows:rows, tRange:[bT,bB], table,
    rows:rowCells, cols:colCells, colHeader,
    logicalRows, tableScore, diag,
    header: bT>0 ? unionBox(rows.slice(0,bT)) : null,
    footer: bB<rows.length-1 ? unionBox(rows.slice(bB+1)) : null
  };
}

/* ----------------------------------------------------------------------
   PASS-BASED TABLE DETECTION
   ----------------------------------------------------------------------
   The whole point of having two directionally-dilated passes is that
   the heavy lifting is already done by the time we get here:

     - Pass B (horizontal-only dilation): each blob is one text-line.
       → Rows are simply the Pass B blobs.

     - Pass C (vertical-only dilation): each blob is one column-stripe.
       → Columns are simply the Pass C blobs.

   So this function does NOT do AABB-level union-find or whitespace-
   projection — the GPU dilation + CCA already did the equivalent.  All
   that's left is:

     1. Convert blobs to row/col objects.
     2. Decide, per row, which columns actually have ink in them
        (using the un-dilated Sauvola binary inside the intersection
        of row.y-range × col.x-range — see rowColumnsByInk).
     3. Score each row by how many columns it occupies.
     4. Find the run of consecutive rows with the highest cumulative
        score — that's the table band (header rows and footer rows
        score badly enough to fall outside the run).
     5. Hand off to buildLayout, which assembles the final layout
        object.

   The legacy cascade of fallback detectors (rlsa → projection →
   groupRows + projection) is gone — pass-level CCA is enough.
   ---------------------------------------------------------------------- */
export function analyzeTable(passB, p, passC){
  passB.layout = null;

  // Empty-layout template returned on any early failure so downstream
  // consumers (renderer, JSON export) always see the same shape.
  const emptyLayout = {
    medH         : 1,
    allRows      : [],
    tRange       : [-1, -1],
    table        : null,
    rows         : [],
    cols         : [],
    header       : null,
    footer       : null,
    colHeader    : -1,
    logicalRows  : [],
    tableScore   : 0
  };

  const diagnostics = {
    source       : 'pass-blobs',
    rowsFromB    : -1,
    colsFromC    : -1,
    medH         : 0,
    band1        : '-',
    note         : ''
  };

  // Need Pass C — without it there's no column source.
  if(!passC){
    diagnostics.note = 'no pass C';
    passB.layout = { ...emptyLayout, diag: diagnostics };
    return;
  }

  // ---- Step 1: rows from Pass B, columns from Pass C ----
  const rowList = rowsFromPassB(passB);
  diagnostics.rowsFromB = rowList.length;
  if(rowList.length < 3){
    passB.layout = { ...emptyLayout, allRows: rowList, diag: diagnostics };
    return;
  }

  const columnList = columnsFromPassC(passC);
  diagnostics.colsFromC = columnList.length;
  if(columnList.length < 2){
    passB.layout = { ...emptyLayout, allRows: rowList, diag: diagnostics };
    return;
  }

  const rowHeights      = rowList.map(r => r.y1 - r.y0).sort((a, b) => a - b);
  const medianRowHeight = rowHeights[rowHeights.length >> 1] || 1;
  diagnostics.medH      = +medianRowHeight.toFixed(1);

  // ---- Step 2: ink-based row × column occupancy ----
  // For each row × column pair, count ink in the un-dilated Sauvola
  // binary inside the intersection rectangle.  Result: a Set of column
  // indices for each row indicating which columns the row has text in.
  const occupancyPerRow = rowList.map(row =>
    rowColumnsByInk(passB.binary, S.W, row, columnList)
  );

  // ---- Step 3: score each row by column-fill count ----
  //   ≥ 2 columns filled → +1.0  (clean multi-column table row)
  //     1 column  filled → -0.3  (wrapped description / single-cell row)
  //     0 columns filled → -0.8  (blank row — likely between tables)
  // Header / footer / title rows typically have 0–1 columns filled and
  // therefore score negatively, which drops them out of the band.
  const rowValues = occupancyPerRow.map(occSet =>
    occSet.size >= 2 ?  1.0 :
    occSet.size === 1 ? -0.3 :
                        -0.8
  );

  // ---- Step 4: find the highest-scoring contiguous run (Kadane) ----
  // The table band = the run of consecutive rows whose cumulative score
  // is maximised.  After Kadane we trim leading/trailing rows whose
  // own value is ≤ 0 so the band starts and ends on real table rows.
  let bestSum         = -Infinity;
  let bandTopIdx      = -1;
  let bandBottomIdx   = -1;
  let currentSum      = 0;
  let currentRunStart = 0;

  for(let i = 0; i < rowList.length; i++){
    // Restart the run whenever cumulative falls to or below zero —
    // standard Kadane's algorithm.
    if(currentSum <= 0){
      currentSum      = rowValues[i];
      currentRunStart = i;
    } else {
      currentSum += rowValues[i];
    }
    if(currentSum > bestSum){
      bestSum       = currentSum;
      bandTopIdx    = currentRunStart;
      bandBottomIdx = i;
    }
  }
  // Trim sub-zero edges.
  while(bandTopIdx >= 0 && bandTopIdx <= bandBottomIdx && rowValues[bandTopIdx] <= 0)    bandTopIdx++;
  while(bandBottomIdx >= bandTopIdx && rowValues[bandBottomIdx] <= 0)                    bandBottomIdx--;

  const bandHeight   = Math.max(0, bandBottomIdx - bandTopIdx + 1);
  diagnostics.band1  = bandTopIdx + '..' + bandBottomIdx + ' (' + bandHeight + ')';

  // Bail if the band is too short to be a table.
  if(bandTopIdx < 0 || bandHeight < 3){
    passB.layout = { ...emptyLayout, medH: medianRowHeight, allRows: rowList, diag: diagnostics };
    return;
  }

  // ---- Step 5: hand off the precomputed occupancy to buildLayout ----
  // We pass occupancyPerRow (the FULL row-indexed array) so buildLayout
  // doesn't recompute occupancy from row.boxes — its legacy AABB-based
  // rowColumns gives meaningless answers on line-level row blobs.
  passB.layout = buildLayout(
    rowList,
    columnList,
    bandTopIdx,
    bandBottomIdx,
    medianRowHeight,
    diagnostics,
    occupancyPerRow
  );
}

/* BORDER-ONLY table detection.  Uses ONLY the detected rules — vertical
   borders become column boundaries, horizontal borders define the table
   band.  If either axis isn't covered by enough borders the layout is
   empty (no fallback to heuristic — that's analyzeTable's job).  The
   pipeline runs both so the gallery can show them side-by-side. */
export function analyzeTableFromBorders(pass, p){
  pass.layoutBorders=null;
  const empty={medH:1,allRows:[],tRange:[-1,-1],table:null,rows:[],cols:[],
               header:null,footer:null,colHeader:-1,logicalRows:[],tableScore:0};
  const boxes=wordAABBs(pass);
  const borders=pass.borders;
  const vL=(borders&&borders.vLines)||[];
  const hL=(borders&&borders.hLines)||[];
  const diag={boxes:boxes.length,rows:0,medH:0,
              borderV:vL.length, borderH:hL.length,
              source:'borders'};
  if(boxes.length<8){ pass.layoutBorders={...empty,diag}; return; }
  const hs=boxes.map(b=>b.h).sort((a,b)=>a-b);
  const medH=hs[hs.length>>1]||1;
  diag.medH=+medH.toFixed(1);
  // Rows come from Pass B blobs directly — the directional-dilation +
  // CCA in runPass already grouped each text-line into a single blob.
  const rows = rowsFromPassB(pass);
  diag.rows=rows.length;
  if(rows.length<3){ pass.layoutBorders={...empty,medH,allRows:rows,diag}; return; }

  // cols from V borders — need ≥ 3 V borders to form ≥ 2 columns
  let cols=null;
  if(vL.length>=2){
    const sV=vL.slice().sort((a,b)=>a.x-b.x);
    const bCols=[];
    for(let i=0;i<sV.length-1;i++) bCols.push({x0:sV[i].x, x1:sV[i+1].x});
    if(bCols.length>=2) cols=bCols;
  }
  // band from H borders — first and last rows whose centre y falls
  // between topmost and bottommost border y
  let bT=-1, bB=-1;
  if(hL.length>=2){
    const sH=hL.slice().sort((a,b)=>a.y-b.y);
    const topY=sH[0].y, botY=sH[sH.length-1].y;
    for(let i=0;i<rows.length;i++){
      const cy=(rows[i].y0+rows[i].y1)/2;
      if(bT<0 && cy>=topY) bT=i;
      if(cy<=botY) bB=i;
    }
  }
  diag.band1 = bT+".."+bB+" ("+Math.max(0,bB-bT+1)+")";

  if(!cols || cols.length<2 || bT<0 || bB-bT+1<3){
    pass.layoutBorders={...empty,medH,allRows:rows,diag};
    return;
  }
  pass.layoutBorders = buildLayout(rows, cols, bT, bB, medH, diag);
}
