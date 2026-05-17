/* ======================================================================
   SECTION 5 · MINIMUM-AREA ORIENTED RECTANGLE  (rotating calipers)
   Why: a word on a skewed line needs a *rotated* box. By the rotating-
   calipers theorem the minimum-area enclosing rectangle is always collinear
   with one hull edge, so testing every hull edge and keeping the smallest
   box is both exact and cheap. The 4 contact points are recorded for display.
   ====================================================================== */

/* =====================================================================
   5. ROTATING CALIPERS  —  minimum-area enclosing rectangle
   For every hull edge the supporting calipers give an aligned box;
   the smallest-area one is the OBB. Records the 4 contact points.
   ===================================================================== */
export function minAreaRect(hull){
  const n=hull.length;
  if(n===0) return null;
  if(n===1){const p=hull[0];return{cx:p.x,cy:p.y,w:1,h:1,angle:0,
    corners:[{x:p.x,y:p.y},{x:p.x+1,y:p.y},{x:p.x+1,y:p.y+1},{x:p.x,y:p.y+1}],
    contacts:[{x:p.x,y:p.y}],area:1};}
  let best=null;
  for(let i=0;i<n;i++){
    const a=hull[i], b=hull[(i+1)%n];
    let ex=b.x-a.x, ey=b.y-a.y;
    const L=Math.hypot(ex,ey)||1; ex/=L; ey/=L;       // edge unit
    let minU=1e18,maxU=-1e18,minV=1e18,maxV=-1e18, iU=0,aU=0,iV=0,aV=0;
    for(let j=0;j<n;j++){
      const dx=hull[j].x-a.x, dy=hull[j].y-a.y;
      const u= dx*ex+dy*ey;       // along edge
      const v=-dx*ey+dy*ex;       // perpendicular
      if(u<minU){minU=u;iU=j;} if(u>maxU){maxU=u;aU=j;}
      if(v<minV){minV=v;iV=j;} if(v>maxV){maxV=v;aV=j;}
    }
    const w=maxU-minU, h=maxV-minV, area=w*h;
    if(!best || area<best.area)
      best={area,ex,ey,ax:a.x,ay:a.y,minU,maxU,minV,maxV,w,h,
            contacts:[iU,aU,iV,aV].map(j=>({x:hull[j].x,y:hull[j].y}))};
  }
  const px=-best.ey, py=best.ex;     // perpendicular
  const C=(u,v)=>({x:best.ax+u*best.ex+v*px, y:best.ay+u*best.ey+v*py});
  let cor=[C(best.minU,best.minV),C(best.maxU,best.minV),C(best.maxU,best.maxV),C(best.minU,best.maxV)];
  // orient clockwise (screen coords) and start from the corner nearest top-left
  let sa=0; for(let i=0;i<4;i++){const a=cor[i],b=cor[(i+1)%4];sa+=a.x*b.y-b.x*a.y;}
  if(sa<0) cor.reverse();
  let s=0,bestSum=1e18;
  for(let i=0;i<4;i++){const sm=cor[i].x+cor[i].y;if(sm<bestSum){bestSum=sm;s=i;}}
  cor=cor.slice(s).concat(cor.slice(0,s));
  const cx=(cor[0].x+cor[2].x)/2, cy=(cor[0].y+cor[2].y)/2;
  return {cx,cy,w:best.w,h:best.h,angle:Math.atan2(best.ey,best.ex),
          corners:cor,contacts:best.contacts,area:best.area};
}
