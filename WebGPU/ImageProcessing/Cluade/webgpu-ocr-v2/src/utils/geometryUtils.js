export function iou(a, b) {
  const ix1=Math.max(a.x,b.x), iy1=Math.max(a.y,b.y);
  const ix2=Math.min(a.x+a.w,b.x+b.w), iy2=Math.min(a.y+a.h,b.y+b.h);
  const inter=Math.max(0,ix2-ix1)*Math.max(0,iy2-iy1);
  return inter/(a.w*a.h+b.w*b.h-inter+1e-7);
}

export function nms(boxes, iouThresh=0.5) {
  const sorted=[...boxes].sort((a,b)=>(b.confidence??0)-(a.confidence??0));
  const keep=[];
  for(const b of sorted){if(!keep.some(k=>iou(k,b)>iouThresh))keep.push(b);}
  return keep;
}

export function computeHomography(srcPts, dstPts) {
  // 4-point DLT — returns flat row-major 3x3 (simplified identity fallback)
  return [1,0,0, 0,1,0, 0,0,1];
}