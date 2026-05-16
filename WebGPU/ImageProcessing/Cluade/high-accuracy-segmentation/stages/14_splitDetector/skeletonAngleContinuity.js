/**
 * Skeleton angle continuity across the shared boundary.
 * Returns score 0..1: 1 = directions align (likely same stroke).
 */
export async function computeSkeletonAngleContinuity(gpuCtx, binaryTex, compA, compB, params) {
  const angleA = estimatePrimaryAngle(compA);
  const angleB = estimatePrimaryAngle(compB);
  const diff   = Math.abs(angleA - angleB) % 180;
  const normDiff = Math.min(diff, 180 - diff);
  return Math.max(0, 1 - normDiff / params.mergeAngleStrictDeg);
}
function estimatePrimaryAngle(comp) {
  // PCA of pixel positions → primary axis angle
  const { x1, y1, x2, y2 } = comp;
  return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
}
