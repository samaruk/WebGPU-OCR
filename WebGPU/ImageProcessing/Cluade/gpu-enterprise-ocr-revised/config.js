
export const CONFIG = {
  width: 0, height: 0,

  sobel:             { threshold: 0.1 },
  adaptiveThreshold: { blockRadius: 15, C: 0.05 },

  ccl: {
    iterationsPerBatch: 8,   // union passes per GPU submit
    maxBatches:         16,  // safety cap → 128 iterations max
  },

  swt: { maxStrokeWidth: 40 },

  textLine: { valleyThreshold: 0.2 },

  watershed: {
    seedMinDist:          0.5,  // px from background; stroke centers are ~strokeWidth/2
    propagateIterations:  8,
  },

  projection: { cutThreshold: 0.05 },

  skeleton: { thinningIterations: 40 },

  resegment: { confidenceThreshold: 0.5, noiseRadius: 2, minNeighbours: 4 },

  // Conditional stage thresholds
  conditional: {
    // Run touching-character stages only if largest blob
    // aspect ratio > this value (indicates merged chars)
    touchingAspectRatio: 2.0,
    // Minimum blob pixel count to consider non-trivial
    minBlobSize: 50,
  },
};
