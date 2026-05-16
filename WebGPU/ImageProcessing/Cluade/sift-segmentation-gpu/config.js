/**
 * config.js – centralised, user-overridable defaults for the SIFT-GPU pipeline.
 */

export const DEFAULT_CONFIG = {
  // ── Preprocessing ───────────────────────────────────────────────────────
  preprocessing: {
    gamma:             1.0,
    claheClip:         2.0,
    claheTileSize:     8,
    bilateralEnabled:  true,
    bilateralSigmaD:   3.0,
    bilateralSigmaR:   0.15,
  },

  // ── Gaussian Pyramid ────────────────────────────────────────────────────
  pyramid: {
    octaves:           4,
    scalesPerOctave:   3,
    initialSigma:      1.6,
    sigmaStep:         Math.SQRT2,
  },

  // ── SIFT Detector ───────────────────────────────────────────────────────
  sift: {
    contrastThreshold: 0.04,
    edgeThreshold:     10.0,
    subpixelIter:      5,
    subpixelEps:       1e-3,
    maxKeypointsPerOctave: 4096,
    orientationBins:   36,
    orientationPeak:   0.8,   // fraction of dominant peak
    descriptorBins:    8,
    descriptorHistBins: 8,
  },

  // ── Clustering ──────────────────────────────────────────────────────────
  clustering: {
    gridCellSize:      32,
    maxKeypointsPerCell: 8,
    descriptorNNRatio: 0.75,
  },

  // ── Stroke / Gradient ───────────────────────────────────────────────────
  stroke: {
    swtMinStroke:      1,
    swtMaxStroke:      20,
    gradientLowThresh: 0.04,
    gradientHighThresh: 0.12,
  },

  // ── Segmentation ────────────────────────────────────────────────────────
  segmentation: {
    minSegmentArea:    200,
    mergeThreshold:    0.45,
    skeletonEnabled:   true,
    maskFusionAlpha:   0.5,
  },

  // ── Graph / Merge ───────────────────────────────────────────────────────
  graph: {
    maxMergeRounds:    8,
    splitEnabled:      true,
    splitScoreThresh:  0.55,
  },

  // ── Post-processing ──────────────────────────────────────────────────────
  postprocess: {
    minAspectRatio:    0.05,
    maxAspectRatio:    20.0,
    polygonEpsilon:    2.0,   // Douglas-Peucker ε in pixels
  },

  // ── GPU dispatch ────────────────────────────────────────────────────────
  gpu: {
    workgroupSizeX:    8,
    workgroupSizeY:    8,
    preferredFormat:   'rgba8unorm',
    timestampEnabled:  false,
  },
};

/**
 * Merge a partial config override into the defaults (shallow-merge per sub-object).
 * @param {Partial<typeof DEFAULT_CONFIG>} overrides
 * @returns {typeof DEFAULT_CONFIG}
 */
export function mergeConfig(overrides = {}) {
  const out = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    out[key] = { ...DEFAULT_CONFIG[key], ...(overrides[key] ?? {}) };
  }
  return out;
}

/** Read all UI sliders and return a live config snapshot. */
export function readUIConfig() {
  const n = id => parseFloat(document.getElementById(id)?.value ?? 0);
  const b = id => document.getElementById(id)?.checked ?? false;
  return {
    preprocessing: {
      gamma:            n('gamma'),
      claheClip:        n('clahe-clip'),
      bilateralEnabled: b('bilateral'),
    },
    pyramid: {
      octaves:          Math.round(n('octaves')),
      scalesPerOctave:  Math.round(n('scales')),
    },
    sift: {
      contrastThreshold: n('contrast-thresh'),
      edgeThreshold:     n('edge-thresh'),
    },
    segmentation: {
      minSegmentArea:   n('min-area'),
      mergeThreshold:   n('merge-thresh'),
      skeletonEnabled:  b('skeleton'),
    },
  };
}
