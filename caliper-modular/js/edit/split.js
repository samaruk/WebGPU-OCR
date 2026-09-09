/* ======================================================================
   SPLIT  ·  where a column can be cut in two
   Why: two printed columns with a narrow gap between them can come out of
   the profile as one ("Trade VAT" read as one column). The operator asks
   for a split; the cut goes into the widest x-gap the glyphs of the item
   rows leave inside the column, away from its edges.
     findSplitGap(spans, x0, x1, opts) -> {x0, x1, width} | null
       spans  – the glyphs' [x0, x1] extents in the column's frame
       x0, x1 – the column's bounds in that frame
       opts.minGap   – narrowest gap accepted (px)
       opts.edgeFrac – a gap must start after this fraction of the width
                       and end before 1 − it (a margin is not a gap)
   ====================================================================== */
export function findSplitGap(spans, x0, x1, opts={}){
  const minGap=opts.minGap??3, edgeFrac=opts.edgeFrac??0.12;
  const W=Math.max(1,Math.round(x1-x0)+1); if(W<2*minGap+2) return null;
  const occ=new Uint8Array(W);
  for(const [a,b] of spans){ const i0=Math.max(0,Math.floor(a-x0)), i1=Math.min(W-1,Math.ceil(b-x0)); for(let i=i0;i<=i1;i++) occ[i]=1; }
  const lo=Math.round(edgeFrac*W), hi=Math.round((1-edgeFrac)*W);
  let best=null, runStart=-1;
  for(let i=0;i<=W;i++){
    const empty=i<W && !occ[i];
    if(empty && runStart<0) runStart=i;
    if((!empty || i===W) && runStart>=0){ const s=runStart, e=i-1; runStart=-1;
      if(s<lo || e>hi) continue;                     // touches an edge margin
      const w=e-s+1; if(w>=minGap && (!best || w>best.width)) best={x0:x0+s, x1:x0+e, width:w}; }
  }
  return best;
}
