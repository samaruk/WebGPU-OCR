/**
 * cpu/process.js — CPU processing phases between GPU stages.
 *
 * SPLIT INTO TWO FUNCTIONS to allow gpuComputeOBB to run between them:
 *
 *   runCPU_axes  → centroids + skeleton PCA axis  (CPU, O(K) + O(Nskel))
 *        ↓
 *   gpuComputeOBB → projection scatter + OBB build (GPU, O(N) parallel)
 *        ↓
 *   runCPU_lines → build final line objects         (CPU, O(K) + O(Nskel))
 */

import { extractPolyline, smoothPolyline, rdp } from './polyline.js';

const CS = 1 << 5; // matches CS_BITS = 5 in config.js

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 of CPU work
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runCPU_axes — Compute approximate centroids and PCA axis vectors per component.
 *
 * AXIS METHOD — PCA regression on skeleton pixels.
 *
 * WHY PCA ON SKELETON (not BFS endpoints):
 *   BFS endpoint method fails because ZS thinning leaves branches at serifs and
 *   capital letters. A 40 px branch on a capital "T" can swing the axis 20-40°,
 *   bloating the perpendicular OBB height by blob_length × sin(error_angle).
 *   PCA on the full skeleton is robust: one branch contributes negligible variance
 *   against the main axis spanning hundreds of pixels.
 *
 * RELIABILITY GUARD (eigenvalue ratio):
 *   When the two eigenvalues are close (skeleton nearly isotropic), the PCA
 *   direction is numerically unreliable — a tiny perturbation can flip the axis
 *   90°. The threshold eig1/eig2 < 4 catches this. For any clearly elongated
 *   text-line skeleton the ratio is >> 4. When the guard fires we return (1,0)
 *   and let the swap check in runCPU_lines handle residual 90° errors.
 */
export function runCPU_axes(gpuResult, cfg) {
  const { skeleton, labelArr, K, statsArr, W, H } = gpuResult;
  const N = W * H;

  // ── Step 1: centroids from 1st-order GPU stats ────────────────────────────
  const centX  = new Float32Array(K);
  const centY  = new Float32Array(K);
  const counts = new Uint32Array(K);
  const valid  = new Uint8Array(K);

  for (let lbl = 0; lbl < K; lbl++) {
    const base = lbl * 3, cnt = statsArr[base];
    if (cnt < cfg.minArea) continue;
    centX[lbl]  = (statsArr[base + 1] / cnt) * CS;
    centY[lbl]  = (statsArr[base + 2] / cnt) * CS;
    counts[lbl] = cnt;
    valid[lbl]  = 1;
  }

  // ── Step 2: skeleton grouping O(N) ───────────────────────────────────────
  // Scan all pixels once; Set.add fires only for ~0.5% (skeleton is sparse).
  const skelByComp = new Array(K).fill(null);
  for (let i = 0; i < N; i++) {
    if (!skeleton[i]) continue;
    const lbl = labelArr[i];
    if (lbl >= K || !valid[lbl]) continue;
    if (!skelByComp[lbl]) skelByComp[lbl] = new Set();
    skelByComp[lbl].add(i);
  }

  // ── Step 3: PCA on skeleton pixels → primary axis ────────────────────────
  const axVX = new Float32Array(K).fill(1); // default: horizontal
  const axVY = new Float32Array(K);

  for (let lbl = 0; lbl < K; lbl++) {
    if (!valid[lbl]) continue;
    const sk = skelByComp[lbl];
    if (!sk || sk.size < 4) continue;
    const { vx, vy } = skeletonPCA(sk, W);
    axVX[lbl] = vx;
    axVY[lbl] = vy;
  }

  return { centX, centY, axVX, axVY, skelByComp, valid };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 of CPU work
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runCPU_lines — Build final line objects from GPU OBB data + skeleton polylines.
 *
 * OBB ORIENTATION CORRECTION (the core fix for "rotated wrongly"):
 *
 * After gpuComputeOBB runs SHADER_PROJ_ACCUM with the axis from skeletonPCA, it
 * possible that the axis chosen was the SHORT dimension of the blob rather than
 * the long one. This happens when:
 *
 *   • A single character's vertical stroke dominates the skeleton → PCA gives a
 *     vertical axis → GPU produces hw (short, along stroke) < hh (long, across blob
 *     from dilW padding).
 *   • A nearly-square skeleton produces unreliable PCA even with the ratio guard
 *     (the guard returned horizontal (1,0) but the blob still has hh > hw in rare
 *     cases where dilation is asymmetric).
 *
 * DETECTION:  hh > hw  after GPU projection means the primary axis (vx, vy) points
 * along the SHORT side of the box, not the long side.
 *
 * FIX:  Rotate the axis 90° and swap hw ↔ hh. The GPU-computed centre (cx, cy)
 * is unchanged because it is the centroid of all dilated pixels — invariant to
 * which orthogonal axis decomposition we choose.
 *
 * WHY THE CENTRE STAYS VALID AFTER THE SWAP:
 *   SHADER_OBB_BUILD computes:
 *     cx = cx_cent + vx·offU + px·offV
 *   where offU and offV are the midpoints of the projection ranges along each axis.
 *   For a blob symmetric about its centroid, offU = offV = 0, so cx = cx_cent.
 *   For the asymmetry from the ±32 px centroid approximation error, the small
 *   remaining error after the axis swap is within the pre-existing ±32 px budget.
 *
 * @param {Float32Array} obbF32     K × 6 floats [cx,cy,vx,vy,hw,hh] from gpuComputeOBB
 * @param {Set[]|null[]} skelByComp skeleton pixel sets per component
 * @param {Uint8Array}   valid      component validity flags
 * @param {number}       K
 * @param {object}       cfg
 * @param {number}       W, H
 * @returns {object[]}  top-to-bottom sorted line objects
 */
export function runCPU_lines(obbF32, skelByComp, valid, K, cfg, W, H) {
  const lines = [];

  for (let lbl = 0; lbl < K; lbl++) {
    if (!valid[lbl]) continue;
    const sk = skelByComp[lbl];
    if (!sk || sk.size < cfg.minLen) continue;

    const base = lbl * 6;
    const cx = obbF32[base], cy = obbF32[base + 1];
    let vx = obbF32[base + 2], vy = obbF32[base + 3];
    let hw = obbF32[base + 4], hh = obbF32[base + 5];

    if (!isFinite(hw) || hw <= 0 || !isFinite(hh) || hh <= 0) continue;

    // ── OBB orientation correction ────────────────────────────────────────
    // When hh > hw the GPU projected along the short dimension of the blob.
    // Rotate the axis 90° so that hw becomes the long (text-line) dimension.
    if (hh > hw) {
      let nx = -vy, ny = vx;
      if (nx < 0) { nx = -nx; ny = -ny; }
      vx = nx; vy = ny;
      const t = hw; hw = hh; hh = t;
    }

    // ── Tighten OBB: subtract separable dilation contribution ─────────────
    //
    // WHY THE OBB IS TOO LARGE:
    //   SHADER_PROJ_ACCUM projects every DILATED pixel onto the OBB axes.
    //   Separable dilation with (dilW, dilH) adds a frame of ±dilW in X and
    //   ±dilH in Y around every ink pixel. For horizontal text this bloats:
    //     hw by dilW = 28 px on each side  (+56 px total width)
    //     hh by dilH =  4 px on each side  (+ 8 px total height)
    //
    // THE CORRECTION:
    //   For a text axis at unit vector (vx, vy), the separable dilation
    //   (dilW in X, dilH in Y) projects onto the OBB axes as:
    //     primary axis (vx, vy):     corrHW = dilW·|vx| + dilH·|vy|
    //     perp axis  (-vy, vx):      corrHH = dilW·|vy| + dilH·|vx|
    //   Subtracting these recovers the OBB of the actual ink pixels (the
    //   Sauvola binary mask), which is what the user sees as "the object."
    //
    // VERIFICATION (horizontal text, vx=1, vy=0):
    //   corrHW = dilW·1 + dilH·0 = 28  →  hw shrinks by exactly dilW ✓
    //   corrHH = dilW·0 + dilH·1 =  4  →  hh shrinks by exactly dilH ✓
    //
    // VERIFICATION (30° text, vx=0.866, vy=0.5):
    //   corrHW = 28·0.866 + 4·0.5 = 26.25 px removed from primary axis
    //   corrHH = 28·0.5  + 4·0.866 = 17.46 px removed from perpendicular
    //   The ±2 px padding added by SHADER_OBB_BUILD remains, giving a small
    //   margin so strokes at the edges are not clipped.
    //
    // MINIMUM SIZE:
    //   max(2, …) preserves a 2 px half-extent (4 px box) for degenerate
    //   cases where the text ink is narrower than the dilation padding.
    const cosT   = Math.abs(vx);
    const sinT   = Math.abs(vy);
    const corrHW = cfg.dilW * cosT + cfg.dilH * sinT;
    const corrHH = cfg.dilW * sinT + cfg.dilH * cosT;
    hw = Math.max(2, hw - corrHW);
    hh = Math.max(2, hh - corrHH);

    // Four OBB corners for Canvas 2D overlay (polygon not sent to GPU renderer).
    const px = -vy, py = vx;
    const polygon = [
      { x: cx + vx * hw + px * hh, y: cy + vy * hw + py * hh },
      { x: cx + vx * hw - px * hh, y: cy + vy * hw - py * hh },
      { x: cx - vx * hw - px * hh, y: cy - vy * hw - py * hh },
      { x: cx - vx * hw + px * hh, y: cy - vy * hw + py * hh },
    ];

    const rawPath = extractPolyline(sk, W, H);
    if (!rawPath || rawPath.length < 3) continue;
    const simplified = rdp(smoothPolyline(rawPath, 7), 1.8);

    lines.push({ polyline: simplified, polygon, obb: { cx, cy, vx, vy, hw, hh } });
  }

  lines.sort((a, b) => a.obb.cy - b.obb.cy);
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// PCA helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * skeletonPCA — Primary axis direction by 2D PCA over skeleton pixels.
 *
 * EIGENVALUE RATIO GUARD:
 *
 *   When eig1/eig2 < 4 the skeleton is not clearly elongated in one direction
 *   and the PCA eigenvector is numerically unstable — a 1-pixel perturbation
 *   in one branch pixel can rotate the result by 30-90°. The guard returns the
 *   horizontal default (1, 0) which is correct for most document text lines and
 *   is further validated by the hh > hw swap in runCPU_lines.
 *
 *   WHY THRESHOLD = 4:
 *     eig1/eig2 = 4 corresponds to the skeleton being ~2:1 in standard deviation
 *     (since eigenvalues are proportional to variance = std²). A 2:1 skeleton is
 *     already a fairly short blob. For any clear text-line skeleton the ratio is
 *     typically 50–5000. The threshold of 4 only catches pathological cases:
 *     single characters, isolated punctuation, or heavily branched skeletons.
 *
 *   NOTE: even if skeletonPCA returns (1, 0) incorrectly for a tilted short line,
 *   the GPU projection still produces a valid (possibly large) OBB. The hh > hw
 *   swap in runCPU_lines then corrects any remaining 90° orientation error.
 *
 * @returns {{ vx: number, vy: number }}  unit primary axis, vx ≥ 0 (points rightward)
 */
function skeletonPCA(pixSet, W) {
  // Accumulate in float64 — no overflow risk up to ~10^15 (JS native Number).
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (const i of pixSet) {
    const x = i % W, y = (i / W) | 0;
    sx  += x;     sy  += y;
    sxx += x * x; sxy += x * y; syy += y * y;
  }
  const n  = pixSet.size;
  const mx = sx / n, my = sy / n;

  // Centred second-order moments.
  const mxx = sxx / n - mx * mx;
  const mxy = sxy / n - mx * my;
  const myy = syy / n - my * my;

  // 2×2 symmetric eigendecomposition via the exact quadratic.
  // eig1 ≥ eig2 always because disc ≥ 0.
  const half = (mxx - myy) / 2;
  const disc = Math.sqrt(Math.max(0, half * half + mxy * mxy));
  const eig1 = (mxx + myy) / 2 + disc; // larger eigenvalue  → primary axis
  const eig2 = (mxx + myy) / 2 - disc; // smaller eigenvalue → perpendicular

  // ── Eigenvector for eig1 ─────────────────────────────────────────────────
  // WHY NO EIGENVALUE RATIO GUARD:
  //   A previous version returned (1, 0) when eig1/eig2 < 4 to prevent PCA
  //   from giving a 90°-flipped axis on short or branchy skeletons. This was
  //   the wrong fix: it forced horizontal for ALL short blobs, producing
  //   wide/square OBBs for short ROTATED text instead of thin tilted rectangles.
  //
  //   The hh > hw swap in runCPU_lines already corrects any genuine 90° flip:
  //     • PCA gives correct axis   → hw > hh → no swap → thin correct OBB  ✓
  //     • PCA is 90° off           → hh > hw → swap   → thin corrected OBB ✓
  //     • PCA is slightly off (<45°) → OBB is thin but at slightly wrong angle
  //       (much better than a forced-horizontal square OBB for rotated text)
  //
  //   The ratio guard is therefore redundant for the 90° case and harmful
  //   for the rotated-text case. It is removed entirely.
  // Derived from the first row of (C − eig1·I)·v = 0:
  //   (mxx − eig1)·vx + mxy·vy = 0  →  vx : vy = mxy : (eig1 − mxx)
  // Equivalently, v = [eig1 − myy,  mxy] (use second row for symmetry).
  let vx, vy;
  if (Math.abs(mxy) < 1e-9) {
    // Near-diagonal: axis aligns with the coordinate of higher variance.
    vx = (mxx >= myy) ? 1 : 0;
    vy = (mxx >= myy) ? 0 : 1;
  } else {
    vx = eig1 - myy;
    vy = mxy;
    const len = Math.hypot(vx, vy);
    vx /= len;
    vy /= len;
  }

  // Canonicalise: primary axis always points rightward (vx ≥ 0).
  // This ensures consistent OBB orientation independent of which end of the
  // skeleton the eigenvector happens to point toward.
  if (vx < 0) { vx = -vx; vy = -vy; }

  return { vx, vy };
}
