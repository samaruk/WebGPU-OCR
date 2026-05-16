/**
 * adaptiveParams.js
 * Builds the immutable per-image parameter object consumed by every stage.
 * Called once after qualityScorer + dpiEstimator complete.
 * All downstream stages read from this object — never from config.js directly.
 */

import { Config } from './config.js';
import { adaptiveHeuristics } from './adaptive/adaptiveHeuristics.js';

/**
 * @param {object} qualityVector - Output of qualityScorer
 * @param {number} estimatedDPI  - Output of dpiEstimator
 * @param {object} stageFlags    - Output of stageGating
 * @returns {Readonly<object>}   - Immutable param object
 */
export function buildAdaptiveParams(qualityVector, estimatedDPI, stageFlags) {
  const { blurScore, noiseRatio, contrastRatio, illuminationVariance, bleedthroughEnergy } = qualityVector;

  // ─── Sauvola bootstrap window (Pass 1, before SWT available) ────────────
  const sauvolaWindowBootstrap = adaptiveHeuristics.sauvolaWindowFromDPI(estimatedDPI);

  // ─── Denoising selection ─────────────────────────────────────────────────
  const useNLM = noiseRatio > Config.QUALITY_NOISE_HIGH;

  // ─── Bilateral params ─────────────────────────────────────────────────────
  const bilateralSigmaSpace = adaptiveHeuristics.bilateralSigmaSpace(noiseRatio);
  const bilateralSigmaColor = adaptiveHeuristics.bilateralSigmaColor(contrastRatio);

  // ─── CLAHE clip limit ─────────────────────────────────────────────────────
  const claheClipLimit = adaptiveHeuristics.claheClipLimit(contrastRatio, illuminationVariance);

  // ─── Hough line removal ───────────────────────────────────────────────────
  const houghThreshold = adaptiveHeuristics.houghThreshold(estimatedDPI);

  // ─── SWT quality gate ─────────────────────────────────────────────────────
  // swtQualityMin comes from Config but may be relaxed for very high quality images
  const swtQualityMin = blurScore > 300
    ? Config.SWT_QUALITY_MIN * 0.85
    : Config.SWT_QUALITY_MIN;

  // ─── h-Minima factor ─────────────────────────────────────────────────────
  // Slightly more aggressive suppression on noisy images
  const hMinimaFactor = adaptiveHeuristics.hMinimaFactor(noiseRatio);

  // ─── Merge thresholds ─────────────────────────────────────────────────────
  const mergeLooseGapFactor  = adaptiveHeuristics.mergeLooseGapFactor(estimatedDPI, blurScore);
  const mergeStrictGapFactor = Config.MERGE_STRICT_GAP_FACTOR;

  // ─── Shape filter ─────────────────────────────────────────────────────────
  const shapeAreaMinFactor = adaptiveHeuristics.shapeAreaMinFactor(estimatedDPI);

  return Object.freeze({
    // Meta
    estimatedDPI,
    qualityVector,
    stageFlags,

    // Denoise
    useNLM,
    bilateralSigmaSpace,
    bilateralSigmaColor,
    nlmH: Config.NLM_H,
    nlmTemplateRadius: Config.NLM_TEMPLATE_RADIUS,
    nlmSearchRadius: Config.NLM_SEARCH_RADIUS,

    // Illumination
    claheClipLimit,
    retinexEnabled: stageFlags.retinex,
    bleedthroughEnabled: stageFlags.bleedthrough,

    // Hough
    houghThreshold,
    houghMinLineLength: Config.HOUGH_MIN_LINE_LENGTH,
    houghWidthGateFactor: Config.HOUGH_WIDTH_GATE_FACTOR,

    // Sauvola
    sauvolaK: Config.SAUVOLA_K,
    sauvolaR: Config.SAUVOLA_R,
    sauvolaWindowBootstrap,
    sauvolaStrokeFactor: Config.SAUVOLA_STROKE_FACTOR,
    sauvolaWindowMin: Config.SAUVOLA_WINDOW_MIN,
    sauvolaWindowMax: Config.SAUVOLA_WINDOW_MAX,

    // SWT
    swtMaxRayLength: Config.SWT_MAX_RAY_LENGTH,
    swtCannyLow: Config.SWT_CANNY_LOW,
    swtCannyHigh: Config.SWT_CANNY_HIGH,
    swtQualityMin,

    // h-Minima
    hMinimaFactor,
    hMinimaMin: Config.H_MINIMA_MIN,
    hMinimaMax: Config.H_MINIMA_MAX,

    // Watershed
    weakBoundaryGradientMin: Config.WEAK_BOUNDARY_GRADIENT_MIN,

    // Merge
    mergeLooseGapFactor,
    mergeStrictGapFactor,
    mergeAngleLooseDeg: Config.MERGE_ANGLE_LOOSE_DEG,
    mergeAngleStrictDeg: Config.MERGE_ANGLE_STRICT_DEG,
    splitConfidenceGate: Config.SPLIT_CONFIDENCE_GATE,

    // Shape
    shapeAreaMinFactor,
    shapeAreaMaxFactor: Config.SHAPE_AREA_MAX_FACTOR,
    shapeAspectMin: Config.SHAPE_ASPECT_MIN,
    shapeAspectMax: Config.SHAPE_ASPECT_MAX,
    shapeConvexityMin: Config.SHAPE_CONVEXITY_MIN,
    shapeEulerMaxHoles: Config.SHAPE_EULER_MAX_HOLES,
  });
}
