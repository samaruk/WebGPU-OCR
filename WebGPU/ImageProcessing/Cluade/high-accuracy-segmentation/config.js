/**
 * config.js
 * Static constants, debug flags, and hard fallback parameters.
 * Nothing here should change based on image content — that belongs in adaptiveParams.js.
 */

export const Config = Object.freeze({

  // ─── WebGPU ───────────────────────────────────────────────────────────────
  WORKGROUP_SIZE_X: 8,
  WORKGROUP_SIZE_Y: 8,
  MAX_TEXTURE_DIMENSION: 8192,

  // ─── Pipeline control ─────────────────────────────────────────────────────
  DEBUG: false,                    // Enable per-stage readback + logging
  PROFILE_STAGES: true,            // Collect GPU timestamps
  VISUALIZE_INTERMEDIATES: true,   // Expose stage outputs to UI tabs

  // ─── DPI / scale ──────────────────────────────────────────────────────────
  ASSUMED_DPI_FALLBACK: 150,       // Used when dpiEstimator cannot converge
  MIN_DPI: 72,
  MAX_DPI: 1200,

  // ─── Quality scorer thresholds ────────────────────────────────────────────
  QUALITY_BLUR_THRESHOLD: 100,     // Laplacian variance below → blurry
  QUALITY_NOISE_HIGH: 0.12,        // Noise σ ratio above → NLM preferred
  QUALITY_CONTRAST_MIN: 0.25,      // Michelson contrast below → CLAHE forced

  // ─── Illumination gate ────────────────────────────────────────────────────
  RETINEX_VARIANCE_GATE: 0.18,     // Illumination variance → enable Retinex
  BLEEDTHROUGH_GATE: 0.08,         // Background energy ratio → enable bleedthrough

  // ─── Denoising ────────────────────────────────────────────────────────────
  BILATERAL_SIGMA_SPACE: 3.0,
  BILATERAL_SIGMA_COLOR: 0.1,
  NLM_H: 0.08,                     // Filter strength for NLM
  NLM_TEMPLATE_RADIUS: 3,
  NLM_SEARCH_RADIUS: 11,

  // ─── Hough line removal ───────────────────────────────────────────────────
  HOUGH_THRESHOLD: 80,             // Minimum votes
  HOUGH_MIN_LINE_LENGTH: 0.4,      // As fraction of image width
  HOUGH_MAX_LINE_GAP: 0.02,
  HOUGH_WIDTH_GATE_FACTOR: 2.5,    // Lines thicker than factor*strokeWidth → skip

  // ─── Sauvola thresholding ─────────────────────────────────────────────────
  SAUVOLA_K: 0.34,                 // Sensitivity constant
  SAUVOLA_R: 128,                  // Dynamic range
  SAUVOLA_WINDOW_MIN: 11,
  SAUVOLA_WINDOW_MAX: 127,
  SAUVOLA_WINDOW_DPI_FACTOR: 0.12, // window = factor * dpi (Pass 1 bootstrap)
  SAUVOLA_STROKE_FACTOR: 3.0,      // window = factor * meanStrokeWidth (Pass 2)

  // ─── SWT ──────────────────────────────────────────────────────────────────
  SWT_MAX_RAY_LENGTH: 200,
  SWT_CANNY_LOW: 0.05,
  SWT_CANNY_HIGH: 0.2,
  SWT_QUALITY_MIN: 0.45,           // Below → fallback mode (no SWT weighting)

  // ─── h-Minima ─────────────────────────────────────────────────────────────
  H_MINIMA_FACTOR: 0.30,           // h = factor * meanStrokeWidth
  H_MINIMA_MIN: 1.0,
  H_MINIMA_MAX: 20.0,

  // ─── Watershed ────────────────────────────────────────────────────────────
  WEAK_BOUNDARY_GRADIENT_MIN: 0.04, // Boundaries below → suppressed

  // ─── Graph merge ──────────────────────────────────────────────────────────
  MERGE_LOOSE_GAP_FACTOR: 1.5,      // Phase 1 gap < factor * meanStrokeWidth
  MERGE_STRICT_GAP_FACTOR: 0.6,     // Phase 2 gap < factor * meanStrokeWidth
  MERGE_ANGLE_LOOSE_DEG: 35,
  MERGE_ANGLE_STRICT_DEG: 18,
  SPLIT_CONFIDENCE_GATE: 0.55,      // Minimum confidence to act on MERGE_CANDIDATE

  // ─── Shape filter ─────────────────────────────────────────────────────────
  SHAPE_AREA_MIN_FACTOR: 0.5,       // minArea = factor * strokeWidth²
  SHAPE_AREA_MAX_FACTOR: 800,
  SHAPE_ASPECT_MIN: 0.08,
  SHAPE_ASPECT_MAX: 16.0,
  SHAPE_CONVEXITY_MIN: 0.35,
  SHAPE_EULER_MAX_HOLES: 4,

  // ─── CCA ──────────────────────────────────────────────────────────────────
  CCA_MAX_LABELS: 65535,

  // ─── Render ───────────────────────────────────────────────────────────────
  RENDER_BOX_COLOR: [0.2, 0.8, 0.4, 1.0],    // RGBA
  RENDER_BOX_THICKNESS: 1.5,
});
