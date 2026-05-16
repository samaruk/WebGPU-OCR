// config.js — Global pipeline configuration

export const CONFIG = {
  // Grayscale
  grayscale: {
    rWeight: 0.299,
    gWeight: 0.587,
    bWeight: 0.114,
  },

  // Adaptive threshold
  threshold: {
    blockSize: 31,      // neighbourhood radius
    C: 8,               // constant subtracted from mean
  },

  // Jump Flooding Algorithm for distance transform
  jfa: {
    maxPasses: 12,      // log2(max_dim) passes
  },

  // Local maxima / circle detection
  circles: {
    localWindowRadius: 5,     // suppress non-maxima within this radius
    minRadius: 4,             // minimum circle radius (px)
    maxRadiusRatio: 0.15,     // max radius as fraction of image short-side
    scoreThreshold: 0.45,     // 0–1 normalized distance threshold
    maxCircles: 8000,
  },

  // Morphology
  morphology: {
    horizontalKernel: 40,   // px — connect text horizontally
    verticalKernel: 3,
    dilateIterations: 2,
  },

  // Text line grouping
  textLines: {
    rowGapTolerance: 6,       // px — merge rows with gap ≤ this
    minLineWidth: 20,         // px
    minLineHeight: 6,
  },

  // Table detection
  table: {
    minCols: 2,
    minRows: 2,
    colGapTolerance: 10,
    rowGapTolerance: 8,
  },

  // Rendering
  render: {
    circleStrokeColor: 'rgba(0, 229, 160, 0.35)',
    circleStrokeLarge: 'rgba(123, 92, 255, 0.5)',
    lineStrokeColor: 'rgba(255, 209, 102, 0.7)',
    tableStrokeColor: 'rgba(255, 77, 109, 0.85)',
    tableFillColor: 'rgba(255, 77, 109, 0.06)',
  }
};
