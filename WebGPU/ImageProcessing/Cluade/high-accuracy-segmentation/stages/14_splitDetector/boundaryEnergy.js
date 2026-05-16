/**
 * Boundary energy at the shared edge between two components.
 * Low gradient → weak boundary → likely false split.
 * Returns score 0..1: 1 = weak boundary (evidence for merge).
 */
export async function computeBoundaryEnergy(gpuCtx, binaryTex, compA, compB, params) {
  // Estimate gap gradient energy (CPU side for now)
  const gapX = Math.max(0, Math.max(compA.x1, compB.x1) - Math.min(compA.x2, compB.x2));
  const gapY = Math.max(0, Math.max(compA.y1, compB.y1) - Math.min(compA.y2, compB.y2));
  const gap  = Math.sqrt(gapX * gapX + gapY * gapY);
  // Smaller gap → more likely the boundary is weak (no actual ink gap)
  return Math.max(0, Math.min(1, 1 - gap / 10));
}
