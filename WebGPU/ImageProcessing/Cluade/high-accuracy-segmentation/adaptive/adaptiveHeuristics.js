/**
 * adaptive/adaptiveHeuristics.js
 * Central repository for all adaptive formulas.
 * Every threshold that scales with image properties is defined here.
 * Import this wherever a computed threshold is needed.
 */
import { Config } from "../config.js";

export const adaptiveHeuristics = {

  /** Sauvola window size from DPI (Pass 1 bootstrap, before SWT). */
  sauvolaWindowFromDPI(dpi) {
    const raw = Math.round(Config.SAUVOLA_WINDOW_DPI_FACTOR * dpi);
    const odd = raw % 2 === 0 ? raw + 1 : raw;
    return Math.max(Config.SAUVOLA_WINDOW_MIN, Math.min(Config.SAUVOLA_WINDOW_MAX, odd));
  },

  /** Sauvola window size from SWT mean stroke width (Pass 2). */
  sauvolaWindowFromStroke(meanStrokeWidth) {
    const raw = Math.round(Config.SAUVOLA_STROKE_FACTOR * meanStrokeWidth);
    const odd = raw % 2 === 0 ? raw + 1 : raw;
    return Math.max(Config.SAUVOLA_WINDOW_MIN, Math.min(Config.SAUVOLA_WINDOW_MAX, odd));
  },

  /** h-Minima suppression value. */
  hValue(meanStrokeWidth, noiseFactor = 1.0) {
    const h = Config.H_MINIMA_FACTOR * meanStrokeWidth * noiseFactor;
    return Math.max(Config.H_MINIMA_MIN, Math.min(Config.H_MINIMA_MAX, h));
  },

  /** h-Minima factor — slightly raised on noisy images. */
  hMinimaFactor(noiseRatio) {
    return Config.H_MINIMA_FACTOR * (1.0 + 0.3 * Math.min(noiseRatio / 0.15, 1.0));
  },

  /** Bilateral spatial sigma from noise ratio. */
  bilateralSigmaSpace(noiseRatio) {
    return Config.BILATERAL_SIGMA_SPACE * (1.0 + noiseRatio * 2.0);
  },

  /** Bilateral color sigma from contrast ratio. */
  bilateralSigmaColor(contrastRatio) {
    return Config.BILATERAL_SIGMA_COLOR / Math.max(0.1, contrastRatio);
  },

  /** CLAHE clip limit from contrast and illumination variance. */
  claheClipLimit(contrastRatio, illuminationVariance) {
    const base = 2.0;
    const boost = (1.0 - contrastRatio) * 4.0 + illuminationVariance * 3.0;
    return Math.max(1.0, Math.min(8.0, base + boost));
  },

  /** Hough threshold scaled to DPI. */
  houghThreshold(dpi) {
    return Math.round(Config.HOUGH_THRESHOLD * (dpi / 150.0));
  },

  /** Phase 1 merge gap factor — slightly looser on blurry images. */
  mergeLooseGapFactor(dpi, blurScore) {
    const blurBoost = blurScore < 50 ? 0.3 : 0.0; // blurry → slightly looser
    return Config.MERGE_LOOSE_GAP_FACTOR + blurBoost;
  },

  /** Minimum shape area factor scaled to DPI. */
  shapeAreaMinFactor(dpi) {
    return Config.SHAPE_AREA_MIN_FACTOR * Math.max(0.5, dpi / 150.0);
  },

  /** Normalized distance for merge decision. */
  normalizedDistance(pixelDist, meanStrokeWidth) {
    return pixelDist / Math.max(1, meanStrokeWidth);
  },
};
