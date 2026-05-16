/**
 * shaders/pca.js — WGSL shaders for GPU-parallel OBB projection and finalization.
 *
 * WHY THIS REPLACES THE TWO O(N) CPU PASSES:
 *   The old cpu/process.js did two full O(N) scans over all pixels:
 *     Pass 1 — covariance accumulation (to get PCA axis direction)
 *     Pass 2 — min/max projection extents (to get OBB dimensions)
 *   For a 2000×2000 image (N = 4 M pixels) with 8–10 FP ops each, these took ~10–20 ms
 *   on a single CPU thread.
 *
 *   These three shaders replace Pass 2 entirely by running the projection scan on the GPU
 *   across all pixels in parallel. Pass 1 (axis direction) is replaced by reading the
 *   skeleton endpoints — the medial axis direction IS the text-line orientation and is
 *   already available from the Zhang-Suen thinning step, at zero extra cost.
 *
 * WHY SKELETON DIRECTION INSTEAD OF COVARIANCE PCA:
 *   Second-order moments (Σdx², Σdxdy, Σdy²) overflow u32/i32 for typical text-line
 *   blobs: a 2000 px wide component with 100 k pixels gives Σdx² ≈ 3 × 10¹⁰, well
 *   beyond u32 max (4.3 × 10⁹). Workarounds (scaled integers, split high/low words)
 *   add complexity for negligible accuracy gain. The skeleton endpoint vector gives the
 *   same axis direction directly, without any accumulation step.
 *
 * STAGE COVERAGE:
 *   PROJ_CLEAR → PROJ_ACCUM (one O(N) GPU pass) → OBB_BUILD (O(K) GPU pass)
 */

/**
 * SHADER_PROJ_CLEAR — Initialise min/max projection accumulators to sentinel values.
 *
 * WHY NECESSARY:
 *   atomicMin starts from INT_MAX (anything is smaller).
 *   atomicMax starts from INT_MIN (anything is larger).
 *   The GPU has no built-in per-element fill for arbitrary values (only clearBuffer
 *   which zeros to 0), so a dedicated shader is required.
 *
 * BUFFER LAYOUT (4 × i32 per component):
 *   [base+0] minU = INT_MAX    projection along primary axis, minimum
 *   [base+1] maxU = INT_MIN    projection along primary axis, maximum
 *   [base+2] minV = INT_MAX    projection along perpendicular axis, minimum
 *   [base+3] maxV = INT_MIN    projection along perpendicular axis, maximum
 *
 * WHY bitcast<i32>(0x80000000u) FOR INT_MIN:
 *   The WGSL literal -2147483648i is technically a unary minus applied to 2147483648,
 *   which overflows i32 before the negation. Using bitcast from the u32 bit pattern
 *   0x80000000 is the portable, spec-conformant way to write INT_MIN.
 */
export const SHADER_PROJ_CLEAR = `
struct P { n: u32, _a: u32, _b: u32, _c: u32 }
@group(0) @binding(0) var<storage, read_write> proj: array<atomic<i32>>;
@group(0) @binding(1) var<uniform>             p:    P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.n) { return; }
  let slot = gid.x & 3u;
  if (slot == 1u || slot == 3u) {
    atomicStore(&proj[gid.x], bitcast<i32>(0x80000000u));
  } else {
    atomicStore(&proj[gid.x], 2147483647i);
  }
}`;

/**
 * SHADER_PROJ_ACCUM — Project every dilated pixel onto its component's OBB axes,
 *                     accumulating min/max extents via atomicMin/atomicMax.
 *
 * WHY atomicMin/atomicMax ON i32 (not f32):
 *   WebGPU has no atomic operations on f32. atomicMin and atomicMax exist for i32 and
 *   u32 only (WGSL spec §17.7). We convert the float projection to a scaled integer
 *   (multiply by PROJ_SCALE then round) so that min/max comparisons in integer space
 *   remain strictly monotone and identical to float comparisons for this range.
 *
 * WHY i32 (not u32) FOR SCALED PROJECTIONS:
 *   Projections u and v are SIGNED — pixels on the left of the centroid have u < 0.
 *   Using u32 with a bias would work but risks overflow. i32 handles the sign directly.
 *   Maximum |u| for a 128 MB image ≤ sqrt(2) × 2896 ≈ 4096 px; with PROJ_SCALE = 16
 *   that is |u_scaled| ≤ 65 536, well within i32 (±2 147 483 647).
 *
 * WHY READ axis[lbl] AND cent[lbl] PER PIXEL (indirect buffer read):
 *   Each pixel belongs to a different component; there is no way to preload the axis for
 *   the whole workgroup without inter-thread synchronisation. The indirect read through
 *   label → component index → axis buffer is a well-known GPU pattern (similar to a
 *   dependent texture fetch) and is fully coalesced when nearby pixels share a component.
 *
 * PRECISION:
 *   PROJ_SCALE = 16 gives 1/16 px = 0.0625 px precision on OBB half-extents.
 *   The final OBB half-widths are accurate to sub-pixel precision, which is more than
 *   sufficient for document text-line bounding boxes.
 */
export const SHADER_PROJ_ACCUM = `
struct P { width: u32, height: u32, ncomp: u32, pscale: u32 }
@group(0) @binding(0) var<storage, read>       label: array<u32>;
@group(0) @binding(1) var<storage, read>       cent:  array<f32>;
@group(0) @binding(2) var<storage, read>       axis:  array<f32>;
@group(0) @binding(3) var<storage, read_write> proj:  array<atomic<i32>>;
@group(0) @binding(4) var<uniform>             p:     P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let lbl = label[gid.y * p.width + gid.x];
  if (lbl >= p.ncomp) { return; }
  let cx = cent[lbl * 2u];
  let cy = cent[lbl * 2u + 1u];
  let vx = axis[lbl * 2u];
  let vy = axis[lbl * 2u + 1u];
  let dx = f32(gid.x) + 0.5 - cx;
  let dy = f32(gid.y) + 0.5 - cy;
  let u  = dx * vx + dy * vy;
  let v  = dx * (-vy) + dy * vx;
  let sc = f32(p.pscale);
  let u_s = i32(round(u * sc));
  let v_s = i32(round(v * sc));
  let base = lbl * 4u;
  atomicMin(&proj[base + 0u], u_s);
  atomicMax(&proj[base + 1u], u_s);
  atomicMin(&proj[base + 2u], v_s);
  atomicMax(&proj[base + 3u], v_s);
}`;

/**
 * SHADER_OBB_BUILD — Convert per-component projection extents into OBB parameters.
 *
 * WHY O(K) INSTEAD OF O(N):
 *   This shader runs one thread per component (K threads total, K ≤ a few hundred for
 *   typical invoice pages). All the expensive per-pixel work was done in PROJ_ACCUM.
 *   This shader just reads the four accumulated extremes and computes the OBB centre
 *   and half-extents with a handful of arithmetic operations per thread.
 *
 * OBB CENTRE FORMULA:
 *   After PROJ_ACCUM, minU/maxU/minV/maxV are relative to the approximated centroid
 *   (cx_cent, cy_cent) along axes (vx,vy) and (-vy,vx). The actual OBB centre is:
 *     cx = cx_cent + vx*offU + px*offV
 *     cy = cy_cent + vy*offU + py*offV
 *   where offU = (minU+maxU)/2 and offV = (minV+maxV)/2 shift from the approximate
 *   centroid to the true geometric centre of the OBB.
 *
 * WHY +2 px PADDING ON hw AND hh:
 *   The dilated blob pixels are centre-sampled at (gid.x+0.5, gid.y+0.5). The outermost
 *   pixel's centre is 0.5 px inside the true blob boundary. Adding 2 px ensures the OBB
 *   fully covers all character strokes without clipping at the edges.
 *
 * OUTPUT (6 × f32 per component, consumed by render/obb.js → SHADER_RENDER):
 *   [cx, cy, vx, vy, hw, hh]
 */
export const SHADER_OBB_BUILD = `
struct P { ncomp: u32, pscale: u32, _b: u32, _c: u32 }
@group(0) @binding(0) var<storage, read>       cent: array<f32>;
@group(0) @binding(1) var<storage, read>       axis: array<f32>;
@group(0) @binding(2) var<storage, read_write> proj: array<i32>;
@group(0) @binding(3) var<storage, read_write> obb:  array<f32>;
@group(0) @binding(4) var<uniform>             p:    P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let lbl = gid.x;
  if (lbl >= p.ncomp) { return; }
  let inv_sc = 1.0 / f32(p.pscale);
  let pb   = lbl * 4u;
  let minU = f32(proj[pb + 0u]) * inv_sc;
  let maxU = f32(proj[pb + 1u]) * inv_sc;
  let minV = f32(proj[pb + 2u]) * inv_sc;
  let maxV = f32(proj[pb + 3u]) * inv_sc;
  let cx_c = cent[lbl * 2u];
  let cy_c = cent[lbl * 2u + 1u];
  let vx = axis[lbl * 2u];
  let vy = axis[lbl * 2u + 1u];
  let px = -vy; let py = vx;
  let hw   = (maxU - minU) * 0.5 + 2.0;
  let hh   = (maxV - minV) * 0.5 + 2.0;
  let offU = (minU + maxU) * 0.5;
  let offV = (minV + maxV) * 0.5;
  let cx   = cx_c + vx*offU + px*offV;
  let cy   = cy_c + vy*offU + py*offV;
  let ob   = lbl * 6u;
  obb[ob+0u] = cx; obb[ob+1u] = cy;
  obb[ob+2u] = vx; obb[ob+3u] = vy;
  obb[ob+4u] = hw; obb[ob+5u] = hh;
}`;
