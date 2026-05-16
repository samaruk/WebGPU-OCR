/**
 * shaders/morphology.js — WGSL shaders: separable dilation and Zhang-Suen thinning.
 *
 * STAGE COVERAGE:  DILATE (H then V)  →  ZHANG-SUEN THINNING
 */

/**
 * SHADER_DILATE — Separable binary morphological dilation with a rectangular structuring element.
 *
 * WHY NECESSARY:
 *   After binarization, individual character strokes are 1–3 px wide. A single word has
 *   gaps of ~3–10 px between letters. Text line detection requires merging all characters
 *   in one line into a single connected blob. Dilation expands each foreground pixel by
 *   (dilW × dilH) in a structuring element that is much wider than tall, bridging
 *   inter-letter gaps horizontally while keeping adjacent lines separate vertically.
 *
 * WHY SEPARABLE (two passes):
 *   A 2-D rectangular dilation of half-size (W, H) naively costs O(W × H) per pixel.
 *   Separating into a horizontal pass (half-size W) then a vertical pass (half-size H)
 *   reduces this to O(W + H) per pixel — a huge saving for W=28, H=4 (112 vs 225 ops).
 *   The vert uniform selects which axis each dispatch operates on.
 *
 * OUTPUT: binary u32 {0,1} consumed by SHADER_ZS.
 */
export const SHADER_DILATE = `
struct P { width: u32, height: u32, half: u32, vert: u32 }
@group(0) @binding(0) var<storage, read>       src: array<u32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<uniform>             p:   P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x >= p.width || y >= p.height) { return; }
  let h = i32(p.half);
  var found = 0u;
  if (p.vert == 0u) {
    let xs = max(0i, i32(x)-h); let xe = min(i32(p.width)-1i, i32(x)+h);
    for (var xi = xs; xi <= xe; xi++) {
      if (src[y * p.width + u32(xi)] != 0u) { found = 1u; break; }
    }
  } else {
    let ys = max(0i, i32(y)-h); let ye = min(i32(p.height)-1i, i32(y)+h);
    for (var yi = ys; yi <= ye; yi++) {
      if (src[u32(yi) * p.width + x] != 0u) { found = 1u; break; }
    }
  }
  dst[y * p.width + x] = found;
}`;

/**
 * SHADER_ZS — One sub-iteration of Zhang-Suen binary thinning.
 *
 * WHY NECESSARY:
 *   OBB orientation is estimated from PCA on the dilated blob's pixel set. But to label
 *   each text line with a sequential number and draw the centre-line dashed polyline, we
 *   need a skeletal (1-px-wide) representation of each blob — the medial axis.
 *
 *   Zhang-Suen iteratively removes border pixels that satisfy two conditions:
 *     A — exactly one 0→1 transition in the clockwise 8-neighbourhood
 *     B — 2 ≤ (number of foreground neighbours) ≤ 6
 *   combined with sub-iteration-specific checks on N, E, S, W neighbours.
 *   After zsIters merge passes, the blobs are thinned to 1-px-wide skeletons.
 *
 * WHY TWO SUB-ITERATIONS PER FULL ITERATION:
 *   Zhang-Suen is a two-phase algorithm. sub=0 targets NW-connected pixels, sub=1 targets
 *   NE-connected ones. Running only one sub-iteration leaves asymmetric skeletons.
 *   The JS caller alternates sub=0 and sub=1 (see runGPU in gpu/pipeline.js).
 *
 * WHY A SEPARATE OUTPUT BUFFER (no in-place):
 *   Pixel removal must be computed simultaneously for all pixels using the same input state.
 *   Writing changes in-place would cause removed pixels to affect neighbours in the same
 *   pass, producing incorrect results. The JS caller ping-pongs between sklA and sklB.
 */
export const SHADER_ZS = `
struct P { width: u32, height: u32, sub: u32, _pad: u32 }
@group(0) @binding(0) var<storage, read>       src: array<u32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<uniform>             p:   P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x >= p.width || y >= p.height) { return; }
  let W = p.width; let i = y*W+x;
  dst[i] = src[i];
  if (src[i]==0u || x==0u || y==0u || x>=W-1u || y>=p.height-1u) { return; }
  let p2=src[(y-1u)*W+x];   let p3=src[(y-1u)*W+(x+1u)];
  let p4=src[y*W+(x+1u)];   let p5=src[(y+1u)*W+(x+1u)];
  let p6=src[(y+1u)*W+x];   let p7=src[(y+1u)*W+(x-1u)];
  let p8=src[y*W+(x-1u)];   let p9=src[(y-1u)*W+(x-1u)];
  let B = p2+p3+p4+p5+p6+p7+p8+p9;
  if (B < 2u || B > 6u) { return; }
  let A = u32(p2==0u&&p3==1u) + u32(p3==0u&&p4==1u) + u32(p4==0u&&p5==1u) +
          u32(p5==0u&&p6==1u) + u32(p6==0u&&p7==1u) + u32(p7==0u&&p8==1u) +
          u32(p8==0u&&p9==1u) + u32(p9==0u&&p2==1u);
  if (A != 1u) { return; }
  if (p.sub == 0u) { if (p2*p4*p6 != 0u || p4*p6*p8 != 0u) { return; } }
  else             { if (p2*p4*p8 != 0u || p2*p6*p8 != 0u) { return; } }
  dst[i] = 0u;
}`;
