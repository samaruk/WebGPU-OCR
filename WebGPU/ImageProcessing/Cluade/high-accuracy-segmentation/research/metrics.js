/**
 * research/metrics.js
 * IoU, F1, split error, and merge error computation for segmentation evaluation.
 */

/**
 * Compute per-character IoU between predicted and ground-truth bounding boxes.
 * Uses Hungarian matching (greedy approximation for speed).
 */
export function computeIoU(predictedBoxes, gtBoxes) {
  const ious = [];
  for (const pred of predictedBoxes) {
    let bestIoU = 0;
    for (const gt of gtBoxes) {
      const iou = boxIoU(pred, gt);
      if (iou > bestIoU) bestIoU = iou;
    }
    ious.push(bestIoU);
  }
  return ious.length > 0 ? ious.reduce((s,v) => s+v, 0) / ious.length : 0;
}

export function boxIoU(a, b) {
  const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const inter = (ix2-ix1) * (iy2-iy1);
  const aArea = (a.x2-a.x1) * (a.y2-a.y1);
  const bArea = (b.x2-b.x1) * (b.y2-b.y1);
  return inter / (aArea + bArea - inter);
}

/**
 * F1 score at a given IoU threshold.
 */
export function computeF1(predictedBoxes, gtBoxes, iouThreshold = 0.5) {
  let tp = 0, fp = 0;
  const matched = new Set();
  for (const pred of predictedBoxes) {
    let hit = false;
    for (let gi = 0; gi < gtBoxes.length; gi++) {
      if (matched.has(gi)) continue;
      if (boxIoU(pred, gtBoxes[gi]) >= iouThreshold) {
        tp++; matched.add(gi); hit = true; break;
      }
    }
    if (!hit) fp++;
  }
  const fn = gtBoxes.length - matched.size;
  const precision = tp / Math.max(1, tp + fp);
  const recall    = tp / Math.max(1, tp + fn);
  const f1 = 2 * precision * recall / Math.max(0.001, precision + recall);
  return { precision, recall, f1, tp, fp, fn };
}

/**
 * Split error: GT boxes that map to 2+ predicted boxes.
 * Merge error: Predicted boxes that cover 2+ GT boxes.
 */
export function computeSplitMergeErrors(predictedBoxes, gtBoxes, iouThreshold = 0.3) {
  let splitErrors = 0, mergeErrors = 0;
  for (const gt of gtBoxes) {
    const covers = predictedBoxes.filter(p => boxIoU(p, gt) >= iouThreshold);
    if (covers.length > 1) splitErrors++;
  }
  for (const pred of predictedBoxes) {
    const covers = gtBoxes.filter(g => boxIoU(pred, g) >= iouThreshold);
    if (covers.length > 1) mergeErrors++;
  }
  return { splitErrors, mergeErrors };
}
