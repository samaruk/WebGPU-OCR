/* ======================================================================
   COLUMN NAMES  ·  a name set on one page is the invoice's
   Why: the pages of an invoice share one layout. A column the operator
   names on one page — "this is the batch number" — is the same column on
   every other page, so the name is kept once for the invoice and laid over
   every page, the ones already read when they are next shown and the ones
   still queued when their run ends. Pages are matched by PLACE, the
   column's share of the table's width, because the column count may
   differ from page to page (a gutter found here and not there).
     columnFractions(C, ci)          → {x0f, x1f}: the column's edges as fractions of the table width
     columnAtFraction(C, x0f, x1f)   → the index of the column at that place, or -1
     mergeRecord(records, rec)       → the records with rec in and any older record for the same key or place out
   ====================================================================== */
export function columnFractions(C, ci){
  const cols=C.columns, X0=cols[0].gutterX0, X1=cols[cols.length-1].gutterX1, w=Math.max(1, X1-X0), c=cols[ci];
  return {x0f:(c.gutterX0-X0)/w, x1f:(c.gutterX1-X0)/w};
}
/* the column at the place [x0f, x1f]: the one the place covers best — the overlap must reach half of the narrower
   of the two and a quarter of the column (a wide column that merely contains the place holds several columns'
   worth and is not the one), the best share of the wider one wins; -1 when none qualifies */
export function columnAtFraction(C, x0f, x1f){
  const cols=C.columns||[]; if(!cols.length) return -1;
  const X0=cols[0].gutterX0, X1=cols[cols.length-1].gutterX1, w=Math.max(1, X1-X0);
  let best=-1, bestScore=0;
  cols.forEach((c,i)=>{
    const a=(c.gutterX0-X0)/w, b=(c.gutterX1-X0)/w;
    const ov=Math.min(b,x1f)-Math.max(a,x0f); if(ov<=0) return;
    if(ov<0.5*Math.min(b-a, x1f-x0f) || ov<0.25*(b-a)) return;
    const score=ov/Math.max(b-a, x1f-x0f);
    if(score>bestScore){ bestScore=score; best=i; }
  });
  return best;
}
export function mergeRecord(records, rec){
  const ov=(a,b)=>{ const o=Math.min(a.x1f,b.x1f)-Math.max(a.x0f,b.x0f); return o/Math.max(1e-6, Math.min(a.x1f-a.x0f, b.x1f-b.x0f)); };
  return records.filter(o=>!((rec.key && o.key===rec.key) || ov(o,rec)>0.5)).concat([rec]);
}
