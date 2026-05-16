/**
 * stages/00_adaptation/stageGating.js
 */
import { computeStageGating } from "../../adaptive/stageGating.js";
export function resolveGating(qualityVector, estimatedDPI) {
  return computeStageGating(qualityVector, estimatedDPI);
}
