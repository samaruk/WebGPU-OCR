/**
 * graph/splitScoring.js – scores a potential component split.
 */
export class SplitScoring {
  /**
   * Returns a score in [0,1] indicating how much this component should be split.
   * High score → strong candidate for splitting.
   */
  static score(component, keypoints) {
    if (!component.bbox) return 0;
    const [x0, y0, x1, y1] = component.bbox;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

    // Elongated components are more likely to contain multiple objects
    const aspect = Math.max(bw, bh) / (Math.min(bw, bh) + 1);
    const elongation = Math.min(1, (aspect - 1) / 4);

    // Large components relative to area → internal gap
    const fill = component.area / (bw * bh + 1);
    const sparseness = 1 - fill;

    // Keypoint density variation: high stdev → multiple clusters
    const kps = keypoints.filter(kp => kp.x >= x0 && kp.x <= x1 && kp.y >= y0 && kp.y <= y1);
    let densityVar = 0;
    if (kps.length > 4) {
      const midX = (x0 + x1) / 2;
      const leftN  = kps.filter(k => k.x < midX).length;
      const rightN = kps.filter(k => k.x >= midX).length;
      const total  = leftN + rightN + 1;
      const balance = 2 * Math.min(leftN, rightN) / total;
      densityVar = 1 - balance;
    }

    return 0.35 * elongation + 0.35 * sparseness + 0.30 * densityVar;
  }
}
