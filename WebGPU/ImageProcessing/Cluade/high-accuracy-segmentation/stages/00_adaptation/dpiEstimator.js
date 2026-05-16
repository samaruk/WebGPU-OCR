/**
 * stages/00_adaptation/dpiEstimator.js
 */
import { estimateDPI } from "../../adaptive/dpiEstimator.js";
export async function runDpiEstimator(gpuCtx, imageData, qualityVector) {
  return estimateDPI(gpuCtx, imageData, qualityVector);
}
