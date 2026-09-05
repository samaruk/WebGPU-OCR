/**
 * GRIDLIFT tuning.
 *
 * Nearly every threshold here is expressed as a *ratio* of the working
 * resolution rather than a pixel count. A hard-coded `gap < 10` is correct for
 * exactly one DPI; the same invoice scanned at 150 and at 600 dpi needs
 * thresholds four times apart. Ratios survive both.
 */

export const DEFAULT_CONFIG = {
  /** Long edge of the working resolution. 1600-2000 keeps 8-9pt text legible
   *  to CCA while capping full-res buffers at ~10 MB each. */
  workingMaxDim: 1800,
  /** Max source taps per axis in the area-average downsample. */
  resampleTaps: 4,

  normalise: { gain: 1.0, bias: 0.0 },

  /** Sauvola local thresholding. radiusRatio is of the working long edge. */
  sauvola: {
    radiusRatio: 0.007, // ~12px at 1800
    minRadius: 6,
    maxRadius: 32,
    k: 0.18,
    R: 0.35,
    softness: 0.03,
    minStdDev: 0.02,
  },

  denoise: { enabled: true },

  gradient: { histBins: 180, magThreshold: 0.12 },

  strokes: {
    /** A rule must span at least this fraction of the page to count. */
    minLenRatioH: 0.045,
    minLenRatioV: 0.030,
    /** Gaps up to this fraction of the page get bridged by linking. */
    linkGapRatioH: 0.015,
    linkGapRatioV: 0.010,
    /** How hard perpendicular ink crowding damps a stroke candidate. */
    crowdingDamp: 0.85,
    crowdingProbe: 6,
    /** Score at/above which a pixel is considered part of a rule. */
    threshold: 0.35,
  },

  suppress: {
    /** Dilate the stroke mask before subtracting so anti-aliased rule edges go
     *  too - otherwise OCR sees a grey ghost where the rule was. */
    dilate: 1,
    strength: 1.0,
  },

  cca: {
    capacity: 65536,
    /** LINK+COMPRESS rounds. Union-find converges in 3-5 for real pages. */
    iterations: 6,
    threshold: 0.35,
    /** Components smaller than this (in working px) are speckle. */
    minArea: 6,
    /** Components taller than this fraction of the page are not glyphs. */
    maxHeightRatio: 0.08,
  },

  /** Stage 13 hypothesis scoring weights. Sum to 1.0. */
  gridScore: {
    lineEvidence: 0.25,
    textAlignment: 0.25,
    rowConsistency: 0.2,
    columnConsistency: 0.2,
    componentDensity: 0.1,
  },

  hypotheses: {
    /** Max hypotheses carried into scoring. */
    maxCandidates: 24,
    /** Column boundaries closer than this ratio apart get merged. */
    mergeRatio: 0.012,
    /** Whitespace gutter must be at least this wide to be a column break. */
    minGutterRatio: 0.008,
    minColumns: 2,
    maxColumns: 14,
    minRows: 2,
  },

  /** Confidence at/above which GRIDLIFT's answer is accepted without help. */
  acceptConfidence: 0.9,
};

/** Deep-merge user overrides onto the defaults. */
export function resolveConfig(overrides = {}) {
  const out = structuredClone(DEFAULT_CONFIG);
  const merge = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof dst[k] === 'object') {
        merge(dst[k], v);
      } else if (v !== undefined) {
        dst[k] = v;
      }
    }
  };
  merge(out, overrides);
  return out;
}
