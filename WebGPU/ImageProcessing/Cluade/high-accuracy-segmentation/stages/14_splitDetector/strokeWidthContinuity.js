/**
 * Stroke width continuity across boundary.
 * Returns score 0..1: 1 = same stroke width (likely same character part).
 */
export async function computeStrokeWidthContinuity(gpuCtx, swtMap, compA, compB, sws, params) {
  if (sws.fallbackMode) return 0.5; // neutral if SWT unreliable
  const msw = sws.get(8);
  const stdDev = sws.strokeWidthStdDev ?? msw * 0.4;
  // Compare average stroke widths in each component region
  const swA = estimateRegionSW(sws, compA);
  const swB = estimateRegionSW(sws, compB);
  const diff = Math.abs(swA - swB);
  const score = Math.max(0, 1 - diff / (stdDev * 2));
  return score;
}
function estimateRegionSW(sws, comp) { return sws.get(8); } // simplified; full: sample swtTex
