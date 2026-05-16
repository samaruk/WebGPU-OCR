/**
 * graph/mergeScoring.js – computes merge likelihood score between two components.
 * Combines colour similarity, area balance, and keypoint-flow evidence.
 */
export class MergeScoring {
  static score(nodeA, nodeB, keypoints) {
    // Colour similarity (if metrics available)
    let colourSim = 0.5;
    if (nodeA.meanR != null && nodeB.meanR != null) {
      const dr = (nodeA.meanR - nodeB.meanR) / 255;
      const dg = (nodeA.meanG - nodeB.meanG) / 255;
      const db = (nodeA.meanB - nodeB.meanB) / 255;
      colourSim = 1 - Math.sqrt(dr*dr + dg*dg + db*db) / Math.sqrt(3);
    }

    // Area balance
    const areaA = nodeA.area ?? 1, areaB = nodeB.area ?? 1;
    const areaBalance = 2 * Math.min(areaA, areaB) / (areaA + areaB);

    // Keypoint flow: count keypoints between bounding boxes
    const x0 = Math.min(nodeA.cx, nodeB.cx) - 20;
    const x1 = Math.max(nodeA.cx, nodeB.cx) + 20;
    const y0 = Math.min(nodeA.cy, nodeB.cy) - 20;
    const y1 = Math.max(nodeA.cy, nodeB.cy) + 20;
    let kpFlow = 0;
    for (const kp of keypoints) {
      if (kp.x >= x0 && kp.x <= x1 && kp.y >= y0 && kp.y <= y1) kpFlow++;
    }
    const kpSim = Math.min(1, kpFlow / 5);

    return 0.45 * colourSim + 0.35 * areaBalance + 0.20 * kpSim;
  }
}
