/**
 * stages/16_shapeFilter/convexityScore.js
 * Separated convexity computation — expensive enough to warrant its own dispatch.
 * Computes convex hull area ratio per component.
 */
export async function runConvexityScore(gpuCtx, labelTex, componentId, comp, registry) {
  // CPU-side convex hull (Graham scan) on sampled pixels for this component
  const { pixels } = comp;
  if (!pixels || pixels.length < 3) return 0.5;
  const hullArea = convexHullArea(pixels);
  const compArea = comp.pixelCount ?? pixels.length;
  return hullArea > 0 ? Math.min(1, compArea / hullArea) : 0;
}

function convexHullArea(points) {
  if (points.length < 3) return 0;
  // Graham scan
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (O, A, B) => (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0]);
  const lower = [], upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = sorted.length-1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  const hull = lower.concat(upper);
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    area += hull[i][0] * hull[j][1] - hull[j][0] * hull[i][1];
  }
  return Math.abs(area) / 2;
}
