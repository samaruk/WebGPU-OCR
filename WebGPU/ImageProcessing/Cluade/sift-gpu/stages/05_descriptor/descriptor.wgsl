// ============================================================
// SIFT-GPU  –  SIFT Descriptor Computation (+ RootSIFT)
//
// For each oriented keypoint:
//  1. Sample a 4×4 grid of 4×4 sub-regions rotated by keypoint orientation.
//  2. Accumulate 8-bin gradient histograms (trilinear weighting).
//  3. L2 normalise, clamp at 0.2, re-normalise.
//  4. RootSIFT: L1 normalise, element-wise sqrt.
//
// Output: descriptors[] – maxKP × 128 f32 values (tightly packed).
// ============================================================

const PI     : f32 = 3.14159265358979;
const TWO_PI : f32 = 6.28318530717959;
const GRID   : u32 = 4u;    // 4×4 spatial cells
const BINS   : u32 = 8u;    // orientation bins per cell
const DESC   : u32 = 128u;  // GRID*GRID*BINS

struct DescParams {
  magFactor  : f32,    // descriptor window = factor × scale (typ. 3)
  maxVal     : f32,    // clamp threshold (typ. 0.2)
  rootSIFT   : u32,    // 1 = apply RootSIFT
  _pad       : u32,
};

struct Keypoint {
  x           : f32,
  y           : f32,
  scale       : f32,
  response    : f32,
  orientation : f32,
  octave      : u32,
  layer       : u32,
  flags       : u32,
};

@group(0) @binding(0) var<uniform>             dp          : DescParams;
@group(0) @binding(1) var gaussTex              : texture_2d<f32>;
@group(0) @binding(2) var<storage, read>        keypoints   : array<Keypoint>;
@group(0) @binding(3) var<storage, read>        kpCount     : u32;
@group(0) @binding(4) var<storage, read_write>  descriptors : array<f32>;  // [kpCount][128]

var<workgroup> desc : array<f32, 128>;

@compute @workgroup_size(128)
fn main(
  @builtin(global_invocation_id)  gid  : vec3<u32>,
  @builtin(local_invocation_id)   lid  : vec3<u32>,
  @builtin(workgroup_id)          wgid : vec3<u32>,
) {
  let kpIdx = wgid.x;
  if (kpIdx >= kpCount) { return; }

  let kp = keypoints[kpIdx];
  if ((kp.flags & 2u) != 0u) { return; }   // rejected
  if ((kp.flags & 4u) == 0u) { return; }   // no orientation

  let tidx = lid.x;
  desc[tidx] = 0.0;
  workgroupBarrier();

  let W      = i32(textureDimensions(gaussTex).x);
  let H      = i32(textureDimensions(gaussTex).y);

  let histWidth = dp.magFactor * kp.scale;   // width of one sub-region in pixels
  let halfSize  = histWidth * f32(GRID) * 0.5;
  let cosT      = cos(-kp.orientation);
  let sinT      = sin(-kp.orientation);
  let cx        = kp.x;
  let cy        = kp.y;

  // Sampling window: (GRID * histWidth + 1) radius
  let radius  = i32(halfSize * sqrt(2.0) + 0.5) + 1;
  let diam    = 2 * radius + 1;
  let numPix  = u32(diam * diam);
  let twoSig2 = 2.0 * (0.5 * f32(GRID)) * (0.5 * f32(GRID));   // Gaussian on descriptor coords

  // Single-thread accumulation (simpler, avoids f32 atomic issues)
  if (tidx == 0u) {
    for (var p = 0u; p < numPix; p++) {
      let row  = i32(p) / diam - radius;
      let col  = i32(p) % diam - radius;
      let sx   = i32(cx) + col;
      let sy   = i32(cy) + row;
      if (sx < 1 || sy < 1 || sx >= W-1 || sy >= H-1) { continue; }

      // Rotate into keypoint frame
      let rCol = f32(col)*cosT - f32(row)*sinT;
      let rRow = f32(col)*sinT + f32(row)*cosT;

      // Map to histogram bin coordinates (centre at 0; range [-GRID/2, GRID/2])
      let norm_c = rCol / histWidth + f32(GRID) * 0.5 - 0.5;
      let norm_r = rRow / histWidth + f32(GRID) * 0.5 - 0.5;

      if (norm_c < -1.0 || norm_r < -1.0 || norm_c >= f32(GRID) || norm_r >= f32(GRID)) { continue; }

      // Gradient in image space
      let gx  = textureLoad(gaussTex, vec2<i32>(sx+1, sy),   0).r
               - textureLoad(gaussTex, vec2<i32>(sx-1, sy),   0).r;
      let gy  = textureLoad(gaussTex, vec2<i32>(sx,   sy+1), 0).r
               - textureLoad(gaussTex, vec2<i32>(sx,   sy-1), 0).r;
      let mag = sqrt(gx*gx + gy*gy);
      var ang = atan2(gy, gx) - kp.orientation;
      if (ang < 0.0)    { ang += TWO_PI; }
      if (ang >= TWO_PI){ ang -= TWO_PI; }

      // Gaussian weight in descriptor space
      let w = exp(-(norm_c*norm_c + norm_r*norm_r) / (2.0 * twoSig2)) * mag;

      // Bin indices (fractional for trilinear interpolation)
      let obin = ang / TWO_PI * f32(BINS);

      // Trilinear weighting across 2×2 spatial bins and 2 orientation bins
      let r0 = i32(floor(norm_r));  let dr = norm_r - f32(r0);
      let c0 = i32(floor(norm_c));  let dc = norm_c - f32(c0);
      let o0 = i32(floor(obin));    let do_ = obin - f32(o0);

      for (var ri = 0; ri <= 1; ri++) {
        let rr = r0 + ri;
        if (rr < 0 || rr >= i32(GRID)) { continue; }
        let wr = select(dr, 1.0-dr, ri == 0);
        for (var ci = 0; ci <= 1; ci++) {
          let cc = c0 + ci;
          if (cc < 0 || cc >= i32(GRID)) { continue; }
          let wc = select(dc, 1.0-dc, ci == 0);
          for (var oi = 0; oi <= 1; oi++) {
            let oo = u32((i32(o0) + oi + i32(BINS)) % i32(BINS));
            let wo = select(do_, 1.0-do_, oi == 0);
            let bin_idx = u32(rr * i32(GRID) + cc) * BINS + oo;
            desc[bin_idx] += w * wr * wc * wo;
          }
        }
      }
    }

    // L2 normalise
    var norm2 = 0.0;
    for (var i = 0u; i < DESC; i++) { norm2 += desc[i]*desc[i]; }
    let invNorm = 1.0 / (sqrt(norm2) + 1e-7);
    for (var i = 0u; i < DESC; i++) { desc[i] = min(desc[i] * invNorm, dp.maxVal); }

    // Re-normalise after clamping
    norm2 = 0.0;
    for (var i = 0u; i < DESC; i++) { norm2 += desc[i]*desc[i]; }
    let invNorm2 = 1.0 / (sqrt(norm2) + 1e-7);
    for (var i = 0u; i < DESC; i++) { desc[i] *= invNorm2; }

    // RootSIFT: L1 normalise then sqrt
    if (dp.rootSIFT != 0u) {
      var l1 = 0.0;
      for (var i = 0u; i < DESC; i++) { l1 += abs(desc[i]); }
      let invL1 = 1.0 / (l1 + 1e-7);
      for (var i = 0u; i < DESC; i++) { desc[i] = sqrt(desc[i] * invL1); }
    }

    // Write to global output
    let base = kpIdx * DESC;
    for (var i = 0u; i < DESC; i++) {
      descriptors[base + i] = desc[i];
    }
  }
}
