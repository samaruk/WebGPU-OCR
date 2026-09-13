/* ======================================================================
   PDF TEXT  ·  the page's own words in place of the OCR reading
   Why: a digital PDF page carries every word with its box. The pipeline
   still finds the rows and columns on the rendered image (the structure
   is the same whatever read the text), but the reading of each line and
   each cell comes from the text layer instead of Tesseract.js — exact, at
   full confidence, no cell pass needed.
     assignWords(words, rowsY, colsX, toX) → cells[r][c] — the words whose
                centre lies in the row's y range and the column's x range,
                left to right; a word between two rows goes to the nearer
                one when within half a row height, a word in a gutter to
                the nearer column when within half a column width
     linesFromWords(words, rows)            → [{rowIndex, text, confidence, words, symbols}]
     recognitionFromPdf(words, textLines, columns) → the recognition result
     pdfCells(words, columns)               → the cell texts for buildCellTexts
   ====================================================================== */

const cy=w=>(w.bb.y0+w.bb.y1)/2, cx=w=>(w.bb.x0+w.bb.x1)/2;

/* rowsY: [{y0,y1}] in image y; colsX: [{x0,x1}] in de-skewed x; toX(x,y) maps an image x to the de-skewed frame */
export function assignWords(words, rowsY, colsX, toX=(x,y)=>x){
  const cells=rowsY.map(()=>colsX.map(()=>[]));
  const rowH=rowsY.length?rowsY.reduce((s,r)=>s+(r.y1-r.y0),0)/rowsY.length:0;
  for(const w of words){
    const y=cy(w), x=toX(cx(w), y);
    let ri=-1, dy=1/0;
    rowsY.forEach((r,i)=>{ const d=y<r.y0?r.y0-y:y>r.y1?y-r.y1:0; if(d<dy){ dy=d; ri=i; } });
    if(ri<0 || dy>0.5*rowH) continue;
    let ci=-1, dx=1/0;
    colsX.forEach((c,i)=>{ const d=x<c.x0?c.x0-x:x>c.x1?x-c.x1:0; if(d<dx){ dx=d; ci=i; } });
    if(ci<0 || dx>0.5*(colsX[ci].x1-colsX[ci].x0)) continue;
    cells[ri][ci].push(w);
  }
  return cells.map(row=>row.map(ws=>ws.sort((a,b)=>a.bb.x0-b.bb.x0).map(w=>w.text).join(' ')));
}

/* rows: [{index, y0, y1}] — the full text lines of the page in image y; a line's words are those whose centre lies
   in its y range, left to right */
export function linesFromWords(words, rows){
  const rowH=rows.length?rows.reduce((s,r)=>s+(r.y1-r.y0),0)/rows.length:0;
  const per=rows.map(()=>[]);
  for(const w of words){ const y=cy(w); let ri=-1, dy=1/0;
    rows.forEach((r,i)=>{ const d=y<r.y0?r.y0-y:y>r.y1?y-r.y1:0; if(d<dy){ dy=d; ri=i; } });
    if(ri>=0 && dy<=0.5*rowH) per[ri].push(w); }
  return rows.map((r,i)=>{ const ws=per[i].sort((a,b)=>a.bb.x0-b.bb.x0);
    return {rowIndex:r.index, text:ws.map(w=>w.text).join(' '), confidence:ws.length?100:0, words:ws.map(w=>({text:w.text, bb:{...w.bb}})), symbols:[]}; });
}

/* the browser glue: the same shapes the OCR reading has (recognition.js), built from the text layer */
export function pdfCells(words, columns){
  if(!columns || !columns.band) return null;
  const rowsY=columns.band.rows.map(r=>({y0:r.row.ink.y0, y1:r.row.ink.y1}));
  const colsX=columns.columns.map(c=>({x0:c.gutterX0, x1:c.gutterX1}));
  return assignWords(words, rowsY, colsX, (x,y)=>columns.toDeskewedX?columns.toDeskewedX(x,y):x);
}
export function recognitionFromPdf(words, textLines, columns){
  const rows=(textLines&&textLines.fullLines&&textLines.fullLines.rows||[]).map((r,i)=>({index:i, y0:r.bb.y0, y1:r.bb.y1}));
  const lines=linesFromWords(words, rows);
  return {available:true, fromPdf:true, language:'pdf', scale:1, cropStyle:'pdf', lines, recognised:words.length, loosePieces:[], cells:pdfCells(words, columns)};
}
