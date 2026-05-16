// Bounding box utilities

/**
 * Decode flat buffer of bboxes: [x0, y0, x1, y1, score, classId, ...]
 */
export function decodeBBoxes(data, stride = 6) {
  const out = [];
  for (let i = 0; i + stride <= data.length; i += stride) {
    out.push({
      x0:    data[i],
      y0:    data[i+1],
      x1:    data[i+2],
      y1:    data[i+3],
      score: data[i+4],
      cls:   data[i+5],
    });
  }
  return out.filter(b => b.score > 0);
}

/** IoU between two axis-aligned bboxes */
export function iou(a, b) {
  const ix0 = Math.max(a.x0, b.x0), iy0 = Math.max(a.y0, b.y0);
  const ix1 = Math.min(a.x1, b.x1), iy1 = Math.min(a.y1, b.y1);
  const inter = Math.max(0, ix1-ix0) * Math.max(0, iy1-iy0);
  const areaA = (a.x1-a.x0)*(a.y1-a.y0);
  const areaB = (b.x1-b.x0)*(b.y1-b.y0);
  return inter / (areaA + areaB - inter + 1e-6);
}

/** NMS */
export function nms(boxes, iouThresh = 0.5) {
  boxes.sort((a,b) => b.score - a.score);
  const keep = [];
  const removed = new Set();
  for (let i = 0; i < boxes.length; i++) {
    if (removed.has(i)) continue;
    keep.push(boxes[i]);
    for (let j = i+1; j < boxes.length; j++) {
      if (!removed.has(j) && iou(boxes[i], boxes[j]) > iouThresh)
        removed.add(j);
    }
  }
  return keep;
}

/** Draw bounding boxes on a 2D canvas context */
export function drawBBoxes(ctx, boxes, W, H, color = '#00ffc8') {
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.5;
  ctx.font        = '10px monospace';
  ctx.fillStyle   = color;
  for (const b of boxes) {
    const x = b.x0 * W, y = b.y0 * H;
    const w = (b.x1 - b.x0) * W, h = (b.y1 - b.y0) * H;
    ctx.strokeRect(x, y, w, h);
    if (b.score > 0) ctx.fillText(b.score.toFixed(2), x+2, y-2);
  }
}
