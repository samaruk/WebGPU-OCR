/* ======================================================================
   CONVEX HULL  ·  Andrew monotone chain, O(n log n)
   Why: the perspective stage fits the page quad to the convex outline of
   the paper region; a traced contour is concave, the hull is not.
   ====================================================================== */
export function convexHull(points){
  const p=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  if(p.length<3) return p;
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lower=[];
  for(const q of p){ while(lower.length>=2 && cross(lower[lower.length-2],lower[lower.length-1],q)<=0) lower.pop(); lower.push(q); }
  const upper=[];
  for(let i=p.length-1;i>=0;i--){ const q=p[i]; while(upper.length>=2 && cross(upper[upper.length-2],upper[upper.length-1],q)<=0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
