/**
 * adaptive/stageGating.js
 * Determines which optional stages should run based on image quality analysis.
 */
import { Config } from "../config.js";

/**
 * @param {object} qualityVector
 * @param {number} estimatedDPI
 * @returns {object} stageFlags
 */
export function computeStageGating(qualityVector, estimatedDPI) {
  const { blurScore, noiseRatio, contrastRatio, illuminationVariance, bleedthroughEnergy } = qualityVector;

  return {
    // Illumination stage sub-steps
    bleedthrough: bleedthroughEnergy > Config.BLEEDTHROUGH_GATE,
    retinex:      illuminationVariance > Config.RETINEX_VARIANCE_GATE,

    // Denoising
    useNLM: noiseRatio > Config.QUALITY_NOISE_HIGH,

    // Morphology
    holeFill: blurScore < Config.QUALITY_BLUR_THRESHOLD || noiseRatio > 0.08,

    // SWT fallback (set after SWT quality gate runs — placeholder here)
    swtFallback: false,
  };
}
