/**
 * stages/17_boundingBoxes/bboxExtract.js
 * Extracts rotated minimum-area bounding boxes (minAreaRect) per component.
 * Handles italic and skewed glyphs correctly.
 * Returns array of { id, cx, cy, w, h, angle, x1, y1, x2, y2 }.
 */
export async function runBBoxExtract(gpuCtx, filteredLabels, registry) {
  const { labelTex, componentCount } = filteredLabels;
  const W = labelTex.width, H = labelTex.height;

  const imgData = await gpuCtx.downloadToImageData(labelTex);
  const labels  = new Uint32Array(W * H);
  for (let i = 0; i < W * H; i++) labels[i] = imgData.data[i * 4];

  // Build pixel lists per component
  const pixelMap = new Map();
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i]; if (!id) continue;
    const x = i % W, y = Math.floor(i / W);
    if (!pixelMap.has(id)) pixelMap.set(id, []);
    pixelMap.get(id).push([x, y]);
  }

  const boxes = [];
  for (const [id, pixels] of pixelMap) {
    if (pixels.length < 4) continue;
    const bbox = minAreaRect(pixels);
    boxes.push({ id, ...bbox });
  }

  return boxes;
}

/**
 * Compute minimum-area bounding rectangle for a set of 2D points.
 * Returns { cx, cy, w, h, angle, x1, y1, x2, y2 }
 */
function minAreaRect(points) {
  // Convex hull first, then rotating calipers
  const hull = convexHull(points);
  let minArea = Infinity, best = null;

  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const dx = hull[j][0] - hull[i][0];
    const dy = hull[j][1] - hull[i][1];
    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(-angle), sin = Math.sin(-angle);

    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for (const [px, py] of hull) {
      const rx = px*cos - py*sin;
      const ry = px*sin + py*cos;
      if (rx<minX) minX=rx; if (rx>maxX) maxX=rx;
      if (ry<minY) minY=ry; if (ry>maxY) maxY=ry;
    }
    const area = (maxX-minX) * (maxY-minY);
    if (area < minArea) {
      minArea = area;
      best = { angle: angle*180/Math.PI, w: maxX-minX, h: maxY-minY,
               cx: (minX+maxX)/2*cos+(minY+maxY)/2*sin,
               cy: -(minX+maxX)/2*sin+(minY+maxY)/2*cos };
    }
  }

  // Fallback axis-aligned
  if (!best) {
    const xs = points.map(p=>p[0]), ys = points.map(p=>p[1]);
    const x1=Math.min(...xs), y1=Math.min(...ys), x2=Math.max(...xs), y2=Math.max(...ys);
    return { cx:(x1+x2)/2, cy:(y1+y2)/2, w:x2-x1, h:y2-y1, angle:0, x1, y1, x2, y2 };
  }

  const xs = points.map(p=>p[0]), ys = points.map(p=>p[1]);
  return { ...best, x1:Math.min(...xs), y1:Math.min(...ys), x2:Math.max(...xs), y2:Math.max(...ys) };
}

function convexHull(points) {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross = (O,A,B) => (A[0]-O[0])*(B[1]-O[1])-(A[1]-O[1])*(B[0]-O[0]);
  const lower=[], upper=[];
  for (const p of sorted) { while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop(); lower.push(p); }
  for (let i=sorted.length-1;i>=0;i--) { const p=sorted[i]; while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
