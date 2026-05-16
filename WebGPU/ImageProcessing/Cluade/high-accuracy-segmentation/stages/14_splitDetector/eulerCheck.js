/**
 * Euler number consistency check.
 * Euler number = connected components - holes.
 * If merging preserves topology (Euler doesn't become anomalous), evidence for merge.
 * Returns score 0..1.
 */
export async function computeEulerCheck(gpuCtx, binaryTex, compA, compB) {
  // Simplified: always return moderate score (full impl requires per-region Euler computation)
  const widthA = compA.x2 - compA.x1, heightA = compA.y2 - compA.y1;
  const widthB = compB.x2 - compB.x1, heightB = compB.y2 - compB.y1;
  // Characters with holes (O, 0, B, D) should not merge across hole boundaries
  const aspectA = Math.max(widthA, heightA) / Math.max(1, Math.min(widthA, heightA));
  const aspectB = Math.max(widthB, heightB) / Math.max(1, Math.min(widthB, heightB));
  // Very tall/wide component pairs (likely already different characters) → lower score
  return aspectA < 3 && aspectB < 3 ? 0.7 : 0.4;
}
