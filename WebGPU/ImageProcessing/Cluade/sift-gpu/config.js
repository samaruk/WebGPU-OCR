// ============================================================
// SIFT-GPU  –  Configuration
// All algorithm parameters in one place.
// ============================================================

export const CONFIG = {
  // ── Scale-space ──────────────────────────────────────────
  sigma0:           1.6,      // base blur (assumed in input image)
  numOctaves:       5,        // number of octaves (set to 0 for auto)
  scalesPerOctave:  5,        // S; each octave has S+3 Gaussian levels
  assumedBlur:      0.5,      // camera/digitisation blur already present

  // ── Keypoint filtering ───────────────────────────────────
  contrastThreshold: 0.02,    // |DoG| threshold (before /S normalisation)
  edgeThreshold:    12,       // Harris/Brown edge ratio threshold

  // ── Orientation ──────────────────────────────────────────
  orientationBins:  36,       // histogram bins for dominant orientation
  orientationPeakRatio: 0.8,  // secondary-peak threshold (× dominant)
  orientationSigmaFactor: 1.5,// magnification of scale for gradient window
  orientationRadius: 3.0,     // radius = factor × layer_sigma

  // ── Descriptor ───────────────────────────────────────────
  descriptorGrid:   4,        // 4×4 spatial sub-regions
  descriptorBins:   8,        // gradient orientation bins per sub-region
  descriptorMagFactor: 3.0,   // descriptor window = factor × scale
  descriptorMaxVal: 0.2,      // clamp before renormalisation
  rootSIFT:         true,     // apply RootSIFT (L1-norm + sqrt)

  // ── Matching ─────────────────────────────────────────────
  ratioThreshold:   0.7,      // Lowe ratio test
  crossCheck:       true,     // mutual nearest-neighbour check

  // ── RANSAC ───────────────────────────────────────────────
  ransacReprojError: 1.75,    // pixels (midpoint of 1.5-2.0 range)
  ransacMaxIter:    2000,

  // ── GPU limits ───────────────────────────────────────────
  maxKeypointsPerOctave: 8192,
  workgroupX: 8,
  workgroupY: 8,
};

/**
 * Compute the number of octaves automatically from image dimensions
 * when CONFIG.numOctaves === 0.
 */
export function autoOctaves(width, height) {
  const minDim = Math.min(width, height);
  return Math.max(1, Math.floor(Math.log2(minDim)) - 3);
}

/**
 * Returns an array of per-scale absolute sigmas for one octave.
 * Length = scalesPerOctave + 3.
 */
export function buildSigmaTable(scalesPerOctave = CONFIG.scalesPerOctave,
                                sigma0          = CONFIG.sigma0) {
  const n    = scalesPerOctave + 3;
  const k    = Math.pow(2, 1 / scalesPerOctave);
  const sigmas = new Float32Array(n);
  sigmas[0]  = sigma0;
  for (let s = 1; s < n; s++) sigmas[s] = sigma0 * Math.pow(k, s);
  return sigmas;
}

/**
 * Returns the *incremental* sigma to apply at each step so that
 * convolving the previous level gives the next level.
 *   σ_inc² = σ_target² – σ_prev²
 */
export function buildIncrementalSigmas(scalesPerOctave = CONFIG.scalesPerOctave,
                                       sigma0          = CONFIG.sigma0) {
  const abs  = buildSigmaTable(scalesPerOctave, sigma0);
  const n    = abs.length;
  const inc  = new Float32Array(n);
  inc[0]     = Math.sqrt(sigma0 ** 2 - CONFIG.assumedBlur ** 2 * 4); // first blur
  for (let s = 1; s < n; s++) {
    inc[s] = Math.sqrt(abs[s] ** 2 - abs[s - 1] ** 2);
  }
  return inc;
}

/**
 * Pre-compute a normalised 1-D Gaussian kernel of radius ceil(3σ).
 */
export function gaussianKernel1D(sigma) {
  const r      = Math.ceil(3 * sigma);
  const size   = 2 * r + 1;
  const kernel = new Float32Array(size);
  let   sum    = 0;
  for (let i = 0; i < size; i++) {
    const x   = i - r;
    kernel[i] = Math.exp(-0.5 * (x / sigma) ** 2);
    sum      += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return kernel;
}
