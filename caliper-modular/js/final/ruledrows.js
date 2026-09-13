/* ======================================================================
   RULED ROWS  ·  one table row per band between the printed rules
   Why: when the border stage found a rule under every row (a full grid, or
   a row-ruled table), the rules say where the rows are. An item whose name
   wraps to a second line is ONE band between two rules, but the text-line
   join and PaddleOCR both read it as two lines — and the final table then
   made two rows of it, the second ("(60s)") a row of its own that went to
   the product match and came back "no match". Here the rows whose centres
   fall between the same two rules are folded into one row, whose cells
   read both lines in reading order.
     ruleLinesY(rowsY, slope)      → the rules' y in the de-skewed frame, sorted
     mergeRowsByRules(rows, ys)    → {rows, merged}: rows in place of the given
                                     ones, neighbours in one band folded together
     readingOrder(words)           → the words of one cell line by line, left to
                                     right within a line
   A band is trusted only when it is no taller than three lines (3.2 × the
   median row height): a sparse rule, one every few rows, must not fold
   several items into one.
   ====================================================================== */
export function ruleLinesY(rowsY, slope){
  return (rowsY||[]).map(r=>r.y-(slope||0)*((r.x0+r.x1)/2)).sort((a,b)=>a-b);
}

/* rows: [{yp0, yp1, y0, y1, localRis:[…], source, …}] sorted by yp0; ys: the rules' y, sorted */
/* keepApart(a,b): rows that are two items whatever the rules say (a serial number on each) are never folded */
export function mergeRowsByRules(rows, ys, maxLines=3.2, keepApart=null){
  if(!rows.length || !ys || ys.length<2) return {rows, merged:0};
  const heights=rows.map(r=>r.yp1-r.yp0).filter(h=>h>0).sort((a,b)=>a-b); const lineH=heights.length?heights[heights.length>>1]:0;
  if(!lineH) return {rows, merged:0};
  const bandOf=r=>{ const yc=(r.yp0+r.yp1)/2; for(let i=0;i<ys.length-1;i++) if(yc>=ys[i] && yc<ys[i+1]) return ys[i+1]-ys[i]<=maxLines*lineH ? i : -1; return -1; };
  const out=[]; let merged=0;
  for(const r of rows){
    const b=bandOf(r); r.ruledBand=b; const last=out[out.length-1];
    if(b>=0 && last && last.ruledBand===b && !(keepApart && keepApart(last,r))){
      last.yp0=Math.min(last.yp0,r.yp0); last.yp1=Math.max(last.yp1,r.yp1); last.y0=Math.min(last.y0,r.y0); last.y1=Math.max(last.y1,r.y1);
      last.localRis=(last.localRis||[]).concat(r.localRis||[]); if(r.source==='api') last.source='api'; last.folded=(last.folded||0)+1; merged++;
    } else out.push(r);
  }
  return {rows:out, merged};
}

/* words with {bbox:{x0,y0,x1,y1}}: line by line (two words whose vertical extents overlap by half of the shorter are one line), left to right within a line */
export function readingOrder(words){
  const lines=[];
  for(const w of words.slice().sort((a,b)=>a.bbox.y0-b.bbox.y0)){
    const h=w.bbox.y1-w.bbox.y0;
    let L=null; for(const l of lines){ const ov=Math.min(l.y1,w.bbox.y1)-Math.max(l.y0,w.bbox.y0); if(ov>=0.5*Math.min(h,l.y1-l.y0)){ L=l; break; } }
    if(L){ L.ws.push(w); L.y0=Math.min(L.y0,w.bbox.y0); L.y1=Math.max(L.y1,w.bbox.y1); } else lines.push({y0:w.bbox.y0, y1:w.bbox.y1, ws:[w]});
  }
  lines.sort((a,b)=>a.y0-b.y0);
  return lines.flatMap(l=>l.ws.sort((a,b)=>a.bbox.x0-b.bbox.x0));
}

/* ---- one line read twice ------------------------------------------------------
   A line that reached the row list twice — a PaddleOCR table row and a second one for the same band, a local row
   the API row did not host — shows as two rows whose heights overlap by most of the shorter one (a curled
   neighbour overlaps a little, never that much). They are folded into one: the union of the extents, the local
   rows of both, the API row of whichever had one. rows: sorted by yp0. */
export function mergeOverlappingRows(rows, frac=0.6, keepApart=null){
  const out=[]; let merged=0;
  for(const r of rows){
    const p=out[out.length-1];
    // two PaddleOCR rows are two rows, however tall the first (a region spanning two lines does not swallow the next
    // line's own row); so are two rows that each carry a serial number
    if(p && !(p.source==='api' && r.source==='api') && !(keepApart && keepApart(p,r))){ const ov=Math.min(p.yp1,r.yp1)-Math.max(p.yp0,r.yp0), h=Math.min(p.yp1-p.yp0, r.yp1-r.yp0);
      if(h>0 && ov>=frac*h){
        p.yp0=Math.min(p.yp0,r.yp0); p.yp1=Math.max(p.yp1,r.yp1); p.y0=Math.min(p.y0,r.y0); p.y1=Math.max(p.y1,r.y1);
        p.localRis=[...new Set((p.localRis||[]).concat(r.localRis||[]))];
        if(p.source!=='api' && r.source==='api'){ p.source='api'; p.apiRow=r.apiRow; }
        merged++; continue; } }
    out.push({...r, localRis:(r.localRis||[]).slice()});
  }
  return {rows:out, merged};
}
