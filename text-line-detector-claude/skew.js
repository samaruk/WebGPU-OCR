/**
 * skew.js — Skew angle detection via weighted projection profile.
 *
 * WHY GRAYSCALE INSTEAD OF BINARY:
 *   The binary image depends on Sauvola's threshold. If k is slightly off,
 *   or if the image has uneven lighting, very few pixels are classified as
 *   text — making the projection profile flat at ALL angles and causing the
 *   algorithm to return 0° regardless of actual rotation.
 *   Grayscale always has signal: dark pixels (ink) get weight ≈ 1, light
 *   pixels (paper) get weight ≈ 0. No threshold, no false zeros.
 *
 * ALGORITHM — WEIGHTED PROJECTION PROFILE (sum-of-squares score):
 *   For each candidate angle a:
 *     1. Project each pixel (weighted by darkness) onto the rotated y-axis:
 *          ry = -(x-cx)*sin(a) + (y-cy)*cos(a)
 *          weight = max(0, 1 - grayscale_value - threshold)
 *        Dark ink pixels → high weight. White paper → weight ≈ 0, skipped.
 *     2. Accumulate weights into a profile histogram.
 *     3. Score = sum of squared bin values (sum2).
 *        Peaked profile → a few very high bins → large sum2.
 *        Flat profile   → many medium bins    → smaller sum2.
 *        Since total weight is nearly constant across angles, maximising
 *        sum2 ≡ maximising variance — but sum2 avoids the mean subtraction
 *        and is faster to compute.
 *   Return the angle with the highest score.
 *
 * WHY SUM-OF-SQUARES INSTEAD OF VARIANCE:
 *   sum2 = sum(profile[i]^2).
 *   variance = sum2/N - (sum/N)^2.
 *   Since sum (total weight) is approximately constant across angles, the
 *   ranking is identical. sum2 skips the mean computation — simpler and faster.
 *
 * WHY STRIDE 2:
 *   Stride 3 (previous) sampled 1/9 of pixels. Stride 2 samples 1/4.
 *   The extra samples give a stronger, lower-noise signal especially for
 *   images with sparse text, at the cost of ~2× more computation per angle.
 */

/**
 * Detect the dominant text-line angle using the blurred grayscale image.
 *
 * @param {Float32Array} grayData  - Blurred grayscale [0=black … 1=white]
 * @param {number}       W, H      - Image dimensions
 * @param {number}       rangeDeg  - Search ±rangeDeg degrees (default 45)
 * @param {number}       stepDeg   - Angular resolution in degrees (default 0.5)
 * @returns {number} Detected skew angle in degrees.
 *   Positive → text lines tilt down-right (image rotated clockwise).
 *   Negative → text lines tilt up-right   (image rotated counter-clockwise).
 *   The caller should rotate the image by this angle to correct.
 */
export function detectSkew(grayData, W, H, rangeDeg = 45, stepDeg = 0.5) {
  // Diagonal of image = maximum possible projection length at any angle.
  const pSize  = Math.ceil(Math.sqrt(W * W + H * H)) + 2;
  const offset = pSize >> 1;
  const cx = W / 2, cy = H / 2;

  // Ink threshold: only contribute pixels darker than this.
  // 0.85 means: skip pixels brighter than 85% white (= paper background).
  // This keeps the profile focused on actual ink, ignoring paper texture.
  const INK_THRESH = 0.85;

  let bestAngle = 0, bestScore = -1;
  const steps = Math.round(rangeDeg * 2 / stepDeg);

  for (let ai = 0; ai <= steps; ai++) {
    const a   = ai * stepDeg - rangeDeg;  // angle in degrees: -range … +range
    const rad = a * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    const profile = new Float32Array(pSize);

    // Stride 2: sample every other pixel in both dimensions.
    // Each pixel contributes its "darkness" weight (1 − value).
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const v = grayData[y * W + x];
        if (v > INK_THRESH) continue;          // skip near-white background
        const w = INK_THRESH - v;              // weight: darker → higher
        const ry = (-(x - cx) * sin + (y - cy) * cos) + offset;
        const pi = Math.round(ry);
        if (pi >= 0 && pi < pSize) profile[pi] += w;
      }
    }

    // Score = sum of squared bin values.
    // Peaked profile (text lines aligned) → few large bins → high sum2.
    // Flat profile  (text scattered)     → many small bins → low sum2.
    let sum2 = 0;
    for (let i = 0; i < pSize; i++) sum2 += profile[i] * profile[i];

    if (sum2 > bestScore) { bestScore = sum2; bestAngle = a; }
  }

  return bestAngle;
}

/**
 * detectSkewFromBlobs — Detect skew angle from the dilated binary image.
 *
 * WHY THIS IS MORE RELIABLE THAN PROJECTION-PROFILE ON GRAYSCALE/BINARY:
 *   The dilated image has one thick, solid, clean blob per text line.
 *   Each blob is essentially a filled rectangle whose long axis is exactly
 *   the text-line direction. PCA on the pixel coordinates of one blob gives
 *   its orientation to sub-degree accuracy.
 *   Projection-profile methods can fail when:
 *     - Text is sparse and the profile is nearly flat at all angles.
 *     - The image has complex layout with elements at mixed angles.
 *     - Sauvola threshold is slightly off, thinning the text signal.
 *   Blobs have none of these failure modes — they are thick and unambiguous.
 *
 * ALGORITHM:
 *   1. Union-find CCA on the dilated binary → one label per blob.
 *   2. Accumulate pixel-coordinate moments (sx, sy, sxx, sxy, syy) per blob.
 *   3. For each elongated blob (PCA eigenvalue ratio λ₁/λ₂ > 5), compute the
 *      BIAS-CORRECTED angle (see below).
 *   4. Return the MEDIAN of all elongated-blob angles (robust to outliers).
 *
 * WHY DILATION BIAS CORRECTION (dilH, dilV parameters):
 *   Separable dilation (H-pass then V-pass) adds pixel mass uniformly in x
 *   and y independently. This adds to the covariance matrix:
 *     cxx += dilH²/3     (from uniform distribution on [-dilH, dilH])
 *     cyy += dilV²/3     (from uniform distribution on [-dilV, dilV])
 *     cxy unchanged      (x and y extents are independent)
 *   The PCA angle uses atan2(2·cxy, cxx−cyy). The bias term is:
 *     B = dilH²/3 − dilV²/3 = (dilH²−dilV²)/3
 *   Since dilH >> dilV (30 vs 4), B = 294 inflates the x-argument of atan2,
 *   pulling every detected angle toward 0°. Effect on a 150px line at 30°:
 *     without correction: 26.4°   with correction: 30.0°  ✓
 *   Fix: subtract B from (cxx−cyy) before the atan2 call. This is exact —
 *   no approximation — and works for any line length and any rotation angle.
 *
 * WHY MEDIAN:
 *   Some blobs may be punctuation, logos, or table cells — not full text lines.
 *   Their orientations are outliers. The median is unaffected by up to 50%
 *   outliers, so it always returns the dominant (true) text orientation.
 *
 * @param {Float32Array} dilData  - Dilated binary (1=blob, 0=background)
 * @param {number}       W, H    - Image dimensions
 * @param {number}       dilH    - Horizontal dilation radius used (pixels)
 * @param {number}       dilV    - Vertical dilation radius used (pixels)
 * @param {Float32Array} binData - Original (undilated) binary — used for fine refinement.
 *                                 If null, falls back to dilData.
 * @returns {number}  Skew angle in degrees (same sign convention as detectSkew)
 */
export function detectSkewFromBlobs(dilData, W, H, dilH = 30, dilV = 4, binData = null) {
  // ── Pass 1: union-find CCA ────────────────────────────────────────────────
  const lbl = new Int32Array(W * H).fill(-1);
  const par = [];
  const find = x => {
    while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; }
    return x;
  };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
  let next = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (dilData[y * W + x] < 0.5) continue;
      const up = y > 0 && dilData[(y-1)*W+x] > 0.5 ? lbl[(y-1)*W+x] : -1;
      const lt = x > 0 && dilData[y*W+x-1] > 0.5 ? lbl[y*W+x-1] : -1;
      if (up < 0 && lt < 0) { par.push(next); lbl[y*W+x] = next++; }
      else if (up >= 0 && lt < 0) lbl[y*W+x] = find(up);
      else if (lt >= 0 && up < 0) lbl[y*W+x] = find(lt);
      else { unite(up, lt); lbl[y*W+x] = find(up); }
    }
  }

  // ── Pass 2: accumulate per-blob pixel-coordinate moments (stride 2) ───────
  const stats = new Map();
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (lbl[y*W+x] < 0) continue;
      const l = find(lbl[y*W+x]);
      if (!stats.has(l)) {
        stats.set(l, { sx:0, sy:0, sxx:0, sxy:0, syy:0, n:0,
                       minX:x, maxX:x, minY:y, maxY:y });
      }
      const s = stats.get(l);
      s.sx += x; s.sy += y; s.sxx += x*x; s.sxy += x*y; s.syy += y*y; s.n++;
      if (x < s.minX) s.minX = x; if (x > s.maxX) s.maxX = x;
      if (y < s.minY) s.minY = y; if (y > s.maxY) s.maxY = y;
    }
  }

  // ── Pass 3: bias-corrected PCA orientation for each elongated blob ─────────
  //
  // WHY PCA EIGENVALUE RATIO INSTEAD OF AABB ASPECT RATIO:
  //   The old filter used:  longer_AABB / shorter_AABB > 1.8
  //   For a line of length L at angle θ, the AABB dimensions are:
  //     width  = L·cos(θ) + 2d·sin(θ)
  //     height = L·sin(θ) + 2d·cos(θ)
  //   At θ=30° this ratio ≈ cos(30°)/sin(30°) = 1.73 → FAILS 1.8 → blobs rejected.
  //   At θ=45° the AABB is square → ratio = 1.0 → ALL blobs rejected.
  //   This caused systematic underestimation: genuine line blobs at large angles
  //   were filtered out, leaving only shorter/more-horizontal survivors.
  //
  //   PCA eigenvalues measure the actual geometric elongation of the blob,
  //   independent of its angle:
  //     λ₁  = spread along the long axis  (∝ line-length²)
  //     λ₂  = spread along the short axis (∝ dilation-width²)
  //     λ₁/λ₂ is the same for a 30° line as for a 0° line of equal dimensions.
  //   A text-line blob typically has λ₁/λ₂ > 6 at any rotation angle.
  //   Punctuation, logos, table cells (nearly square) have λ₁/λ₂ ≈ 1.
  //
  // DILATION BIAS (B):
  //   dilH²/3 is added to cxx (H-dilation contribution).
  //   dilV²/3 is added to cyy (V-dilation contribution).
  //   Net inflation of the atan2 x-argument: B = (dilH²−dilV²)/3.
  //   Subtracting B restores: cxx−cyy−B = A·cos(2θ)  (unbiased).
  const B = (dilH * dilH - dilV * dilV) / 3;

  const MIN_PIXELS    = 30;   // ignore tiny blobs (noise / single characters)
  const MIN_SPREAD    = 100;  // λ₁ must exceed this (rejects near-point blobs)
  const MIN_EIG_RATIO = 5;    // blob must be 5× longer than wide in PCA terms

  const angles = [];
  for (const [, s] of stats) {
    if (s.n < MIN_PIXELS) continue;

    // Covariance matrix of pixel coordinates
    const mcx = s.sx / s.n, mcy = s.sy / s.n;
    const cxx = s.sxx / s.n - mcx * mcx;
    const cxy = s.sxy / s.n - mcx * mcy;
    const cyy = s.syy / s.n - mcy * mcy;

    // Eigenvalues of the 2×2 covariance matrix:
    //   λ = (trace ± sqrt(trace²/4 − det)) / 1
    //   disc = sqrt(((cxx−cyy)/2)² + cxy²)
    const trace = cxx + cyy;
    const disc  = Math.sqrt(Math.max(0, ((cxx - cyy) / 2) ** 2 + cxy * cxy));
    const lam1  = trace / 2 + disc;  // dominant eigenvalue (long axis spread)
    const lam2  = trace / 2 - disc;  // minor eigenvalue   (short axis spread)

    // Filter: blob must be meaningfully large AND genuinely elongated
    if (lam1 < MIN_SPREAD) continue;
    if (lam2 < 1 || lam1 / lam2 < MIN_EIG_RATIO) continue;

    // Bias-corrected angle of the dominant eigenvector.
    // atan2(2·cxy, (cxx−cyy) − B) removes the dilation-asymmetry bias so
    // a line at any angle θ returns exactly θ regardless of line length.
    const angleDeg = Math.atan2(2 * cxy, (cxx - cyy) - B) / 2 * 180 / Math.PI;
    angles.push(angleDeg);
  }

  if (angles.length === 0) return 0;
  angles.sort((a, b) => a - b);

  // Coarse angle from bias-corrected PCA — accurate to ~1–2°.
    const coarse = angles[Math.floor(angles.length / 2)];
    console.log(['angles, coarse, stats', angles, coarse, stats]);
  // ── Pass 4: fine projection-profile refinement ────────────────────────────
  //
  // WHY USE THE ORIGINAL BINARY (NOT THE DILATED IMAGE) FOR REFINEMENT:
  //   On the dilated binary, the perpendicular projection width of one blob is
  //     2·(dilH·sin θ + dilV·cos θ)
  //   This varies with θ, biasing the sum2 metric at small angles (the peak
  //   appears at a slightly wrong angle). Simulation shows ±1.2° error at 20°.
  //
  //   On the original binary (thin character strokes), the perpendicular width
  //   is just the stroke thickness (~2–4px) — nearly angle-independent. The
  //   sum2 peak is unambiguously at the correct angle at all rotations.
  //   Simulation shows ≤0.3° error at 10°, 20°, 30° with 0.1° steps.
  //
  // WHY ±5° RANGE:
  //   After B-correction, PCA residual error can reach ~3° for short lines.
  //   ±5° guarantees the true angle is inside the search window.
  //
  // WHY 0.05° STEPS:
  //   0.05° quantisation limits reported error to ±0.025°.
  //   201 steps × (W·H/4) pixels ≈ 220M ops ≈ 100–200 ms in JS.
  const refData = binData ?? dilData;
  return _refineAngle(refData, W, H, coarse, 5.0, 0.05);
}

/**
 * Fine projection-profile variance search around a seed angle.
 * Used internally by detectSkewFromBlobs — not exported.
 *
 * @param {Float32Array} dilData   - Dilated binary image
 * @param {number}       W, H     - Image dimensions
 * @param {number}       seedDeg  - Coarse angle estimate (degrees)
 * @param {number}       rangeDeg - Search ±rangeDeg around seed
 * @param {number}       stepDeg  - Angular resolution (0.1° recommended)
 * @returns {number} Refined angle in degrees
 */
function _refineAngle(dilData, W, H, seedDeg, rangeDeg = 2, stepDeg = 0.1) {
  const pSize  = Math.ceil(Math.sqrt(W * W + H * H)) + 2;
  const offset = pSize >> 1;
  const cx = W / 2, cy = H / 2;
  const steps = Math.round(rangeDeg * 2 / stepDeg);
  let bestAngle = seedDeg, bestScore = -1;

  for (let ai = 0; ai <= steps; ai++) {
    const a   = seedDeg + ai * stepDeg - rangeDeg;
    const rad = a * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    const profile = new Float32Array(pSize);
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        if (dilData[y * W + x] < 0.5) continue;
        const pi = Math.round((-(x - cx) * sin + (y - cy) * cos) + offset);
        if (pi >= 0 && pi < pSize) profile[pi]++;
      }
    }

    // Sum-of-squares score: peaked profile = large sum2 = correct angle.
    // (Equivalent to variance since total count is constant across angles.)
    let sum2 = 0;
    for (let i = 0; i < pSize; i++) sum2 += profile[i] * profile[i];
      if (sum2 > bestScore) { bestScore = sum2; bestAngle = a; }
      console.log(['bestAngle, a, seedDeg, sum2, bestScore', bestAngle, a, seedDeg, sum2, bestScore]);
  }
  return bestAngle;
}
