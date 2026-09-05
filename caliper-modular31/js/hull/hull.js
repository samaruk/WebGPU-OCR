/* ======================================================================
   SECTION 4 · CONVEX HULL  (Andrew monotone chain)
   Why: the minimum-area-rectangle theorem only holds for a convex polygon,
   and a traced contour is concave. The monotone chain returns the hull in
   O(n log n); it is the mandatory pre-condition for the calipers stage.
   ====================================================================== */

/* =====================================================================
   4. CONVEX HULL  —  Andrew monotone chain
   ===================================================================== */
export function convexHull(pts){
  if(pts.length<3) return pts.map(p=>({x:p.x,y:p.y}));
  const p=pts.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  const uq=[]; for(let i=0;i<p.length;i++){const q=p[i];if(i&&q.x===p[i-1].x&&q.y===p[i-1].y)continue;uq.push(q);}
  if(uq.length<3) return uq.map(p=>({x:p.x,y:p.y}));
  const cr=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lo=[]; for(const q of uq){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
  const up=[]; for(let i=uq.length-1;i>=0;i--){const q=uq[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
  lo.pop(); up.pop();
  return lo.concat(up);
}
