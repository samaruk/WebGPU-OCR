/**
 * shaders/binarize.js — WGSL shaders: grayscale conversion, SAT build, Sauvola threshold.
 *
 * WHY A DEDICATED SHADER FILE PER STAGE:
 *   Shader source is long string data. Grouping it by pipeline stage means you can paste
 *   any shader into a WGSL validator, swap a stage without touching pipeline code, and
 *   read the algorithm commentary next to the WGSL that implements it.
 *
 * STAGE COVERAGE:  GRAY  →  SAT × 2  →  SAUVOLA
 */

/**
 * SHADER_GRAY — Pack RGBA u32 → grayscale f32 (and f32² for variance).
 *
 * WHY NECESSARY:
 *   All downstream stages require a single intensity channel. Writing both gray and gray²
 *   in one dispatch avoids re-reading the full RGBA buffer twice (once per SAT channel).
 *   BT.601 weights (0.299 R + 0.587 G + 0.114 B) match human perceived brightness;
 *   equal weights would make red ink look lighter than it appears visually.
 */
export const SHADER_GRAY = `
struct P { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read>       rgba:  array<u32>;
@group(0) @binding(1) var<storage, read_write> gray:  array<f32>;
@group(0) @binding(2) var<storage, read_write> grayq: array<f32>;
@group(0) @binding(3) var<uniform>             p:     P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x >= p.width || y >= p.height) { return; }
  let i = y * p.width + x;
  let px = rgba[i];
  let r = f32(px & 0xFFu)/255.0;
  let g = f32((px >> 8u) & 0xFFu)/255.0;
  let b = f32((px >> 16u) & 0xFFu)/255.0;
  let lum = 0.299*r + 0.587*g + 0.114*b;
  gray[i]  = lum;
  grayq[i] = lum * lum;
}`;

/**
 * SHADER_SAT — One doubling step of a parallel prefix scan (Summed-Area Table build).
 *
 * WHY NECESSARY:
 *   Sauvola needs local mean and variance over a (2R+1)² window per pixel. A naive loop
 *   costs O(R²) per pixel — ~1 600 ops for R=20. A SAT drops any rectangular query to
 *   O(1) after an O(N log N) build.
 *
 * HOW IT WORKS:
 *   dst[i] = src[i] + src[i − stride].
 *   Called with stride = 1, 2, 4, … up to image width/height; each call doubles the
 *   scan's reach. Total calls ≈ 2 × log₂(max(W,H)) — logarithmic in image size.
 *
 * WHY PING-PONG BUFFERS:
 *   Writing src[i] while another thread reads src[i+stride] from the same buffer causes
 *   a data hazard. Alternating two buffers (see computeSAT in gpu/dispatch.js) is the
 *   standard GPU prefix-sum pattern and guarantees correct results.
 */
export const SHADER_SAT = `
struct P { width: u32, height: u32, stride: u32, vert: u32 }
@group(0) @binding(0) var<storage, read>       src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<f32>;
@group(0) @binding(2) var<uniform>             p:   P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x >= p.width || y >= p.height) { return; }
  let i = y * p.width + x;
  var v = src[i];
  if (p.vert == 0u) { if (x >= p.stride) { v += src[y * p.width + (x - p.stride)]; } }
  else              { if (y >= p.stride) { v += src[(y - p.stride) * p.width + x]; } }
  dst[i] = v;
}`;

/**
 * SHADER_SAUVOLA — Adaptive local-threshold binarization.
 *
 * WHY NECESSARY:
 *   Global thresholds fail on scans with uneven lighting, shadows, or yellowed paper.
 *   Sauvola computes a per-pixel threshold T = μ × (1 + k × (σ/R − 1)) where μ and σ
 *   come from the SATs in O(1). In uniform bright areas the threshold is lenient; in
 *   high-contrast edges it drops to catch thin strokes. k and radius are UI-tunable.
 *
 * WHY max(0, v2/n − mean²) IN σ COMPUTATION:
 *   Floating-point rounding in the SAT can produce tiny negative numbers for v2/n − mean²
 *   in flat regions. sqrt of a negative is NaN, which propagates and corrupts the output.
 *
 * OUTPUT: binary u32 {0 = background, 1 = foreground} consumed by SHADER_DILATE.
 */
export const SHADER_SAUVOLA = `
struct P { width: u32, height: u32, radius: u32, _pad: u32, k: f32, R: f32 }
@group(0) @binding(0) var<storage, read>       sat1: array<f32>;
@group(0) @binding(1) var<storage, read>       sat2: array<f32>;
@group(0) @binding(2) var<storage, read>       gray: array<f32>;
@group(0) @binding(3) var<storage, read_write> out:  array<u32>;
@group(0) @binding(4) var<uniform>             p:    P;
fn s1(xi: i32, yi: i32) -> f32 {
  if (xi < 0i || yi < 0i) { return 0.0; }
  return sat1[u32(yi) * p.width + u32(xi)];
}
fn s2(xi: i32, yi: i32) -> f32 {
  if (xi < 0i || yi < 0i) { return 0.0; }
  return sat2[u32(yi) * p.width + u32(xi)];
}
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x >= p.width || y >= p.height) { return; }
  let r = i32(p.radius);
  let W = i32(p.width); let H = i32(p.height);
  let ix = i32(x); let iy = i32(y);
  let x1 = max(0i, ix-r); let y1 = max(0i, iy-r);
  let x2 = min(W-1i, ix+r); let y2 = min(H-1i, iy+r);
  let n = f32((x2-x1+1i) * (y2-y1+1i));
  let v1 = s1(x2,y2) - s1(x1-1i,y2) - s1(x2,y1-1i) + s1(x1-1i,y1-1i);
  let v2 = s2(x2,y2) - s2(x1-1i,y2) - s2(x2,y1-1i) + s2(x1-1i,y1-1i);
  let mean   = v1 / n;
  let stddev = sqrt(max(0.0, v2/n - mean*mean));
  let thr    = mean * (1.0 + p.k * (stddev/p.R - 1.0));
  out[y * p.width + x] = select(0u, 1u, gray[y * p.width + x] < thr);
}`;
