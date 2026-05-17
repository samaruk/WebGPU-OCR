/* ======================================================================
   SECTION 3 · CONTOUR TRACING  (Moore-neighbour, 8-connected)
   Why: the convex hull and the calipers box only need a component's outline,
   not its filled interior. Tracing the boundary once converts an area of
   pixels into an ordered polygon — orders of magnitude fewer points for the
   later stages to process.
   ====================================================================== */

/* =====================================================================
   3. CONTOUR  —  Moore-neighbour boundary tracing (8-connected)
   ===================================================================== */
export const DX8=[1,1,0,-1,-1,-1,0,1], DY8=[0,1,1,1,0,-1,-1,-1];
export const DIR_IX=[5,4,3,6,-1,2,7,0,1]; // index by (dx+1)*3+(dy+1)
export function traceContour(labels,W,H,lab,startIdx,bb){
  const sx=startIdx%W, sy=(startIdx/W)|0;
  const inB=(x,y)=> x>=0&&x<W&&y>=0&&y<H && labels[y*W+x]===lab;
  let bx=sx-1,by=sy;                       // backtrack cell (background, west of start)
  let px=sx,py=sy;
  const out=[{x:sx,y:sy}];
  const cap=8*((bb.x1-bb.x0)+(bb.y1-bb.y0))+32;
  for(let it=0;it<cap;it++){
    const d=DIR_IX[(bx-px+1)*3+(by-py+1)];
    let nx=-1,ny=-1,nb=-1;
    for(let kk=1;kk<=8;kk++){
      const dd=(d+kk)&7;
      const cx=px+DX8[dd], cy=py+DY8[dd];
      if(inB(cx,cy)){
        nx=cx;ny=cy;nb=(dd+7)&7; break;
      }
    }
    if(nx<0) break;                        // isolated single pixel
    bx=px+DX8[nb]; by=py+DY8[nb];
    px=nx; py=ny;
    if(px===sx && py===sy) break;          // closed the loop
    out.push({x:px,y:py});
  }
  return out;
}
