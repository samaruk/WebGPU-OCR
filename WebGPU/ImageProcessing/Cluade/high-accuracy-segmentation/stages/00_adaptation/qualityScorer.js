/**
 * stages/00_adaptation/qualityScorer.js
 * Entry point for quality analysis. Delegates to adaptive/qualityScorer.js.
 */
import { computeQualityScore } from "../../adaptive/qualityScorer.js";
export async function runQualityScorer(gpuCtx, imageData) {
  return computeQualityScore(gpuCtx, imageData);
}
