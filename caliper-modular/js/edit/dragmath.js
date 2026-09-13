/* ======================================================================
   DRAG MATH  ·  the geometry behind the two drags on the column stages
   Why: on 22CL (Columns) a column boundary is dragged left or right; on
   24CL (Table Layout) the table's top or bottom edge is dragged up or
   down. What a drag means — which boundary is under the pointer, how far
   it may go, which rows the new edge takes in — is pure geometry, kept
   here without a page in it so it can be tested.
     boundariesOf(columns)                → [x…] the N+1 boundaries in de-skewed x (edges and gutter middles)
     boundaryAt(columns, xd, tol)         → the index of the boundary within tol of xd, or -1
     clampBoundary(columns, i, xd, minW)  → xd kept so both neighbours stay at least minW wide
     moveBoundaryIn(columns, i, xd)       → the columns with boundary i at xd (gutterX0/gutterX1 set, manual)
     bandEdgeFor(rows, first, last, which, yp) → {first, last} with the top or bottom edge moved to the row at yp
   rows: [{row:{dy:{y0,y1}}, kind}] in reading order (kind 'merged' rows are skipped).
   ====================================================================== */
export function boundariesOf(columns){
  const N=columns.length; if(!N) return [];
  const b=[columns[0].gutterX0];
  for(let i=1;i<N;i++) b.push((columns[i-1].gutterX1+columns[i].gutterX0)/2);
  b.push(columns[N-1].gutterX1);
  return b;
}
export function boundaryAt(columns, xd, tol){
  const b=boundariesOf(columns); let best=-1, bd=tol;
  b.forEach((x,i)=>{ const d=Math.abs(x-xd); if(d<=bd){ bd=d; best=i; } });
  return best;
}
export function clampBoundary(columns, i, xd, minW=4){
  const N=columns.length;
  const lo=i>0 ? columns[i-1].gutterX0+minW : -1/0;
  const hi=i<N ? columns[i].gutterX1-minW : 1/0;
  return Math.min(hi, Math.max(lo, xd));
}
export function moveBoundaryIn(columns, i, xd){
  const N=columns.length, x=clampBoundary(columns, i, xd);
  const out=columns.map(c=>({...c}));
  if(i>0){ out[i-1].gutterX1=i<N ? x-1 : x; out[i-1].manual=true; }
  if(i<N){ out[i].gutterX0=i>0 ? x+1 : x; out[i].manual=true; }
  return out;
}
/* the row the edge lands on: the top edge takes the first row whose band reaches down to yp, the bottom edge the
   last row whose band reaches up to it; the band never inverts (top ≤ bottom) and never empties */
export function bandEdgeFor(rows, first, last, which, yp){
  const live=rows.map((r,k)=>({k, y0:r.row.dy.y0, y1:r.row.dy.y1, merged:r.kind==='merged'})).filter(r=>!r.merged);
  if(!live.length) return {first, last};
  if(which==='top'){
    let k=live[live.length-1].k; for(const r of live){ if(r.y1>=yp){ k=r.k; break; } }
    return {first:Math.min(k,last), last};
  } else {
    let k=live[0].k; for(let j=live.length-1;j>=0;j--){ if(live[j].y0<=yp){ k=live[j].k; break; } }
    return {first, last:Math.max(k,first)};
  }
}
