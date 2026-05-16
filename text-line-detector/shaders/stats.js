/**
 * shaders/stats.js — WGSL shaders for per-component statistic accumulation via atomics.
 *
 * WHY A SEPARATE FILE:
 *   These two shaders form a self-contained "map-reduce" step: clear accumulators,
 *   then scatter pixel coordinates into per-component buckets. The atomic pattern is
 *   architecturally distinct from the image-processing and CCA shaders.
 *
 * PURPOSE:
 *   After GPU CCA produces a per-pixel label, we need per-component centroids to
 *   perform PCA axis estimation on the CPU. Rather than reading back all pixel
 *   coordinates and grouping them in JS (O(N) memory + JS overhead), we use GPU
 *   atomics to accumulate the three statistics needed for centroid estimation in
 *   a single parallel O(N) scatter pass.
 *
 * STATS LAYOUT (3 u32 slots per component, consumed by runCPU in cpu/process.js):
 *   [base+0] count          — number of foreground pixels in this component
 *   [base+1] sum(x >> CS)   — sum of x coordinates right-shifted by CS_BITS
 *   [base+2] sum(y >> CS)   — sum of y coordinates right-shifted by CS_BITS
 *
 * WHY ONLY FIRST-ORDER STATS (no Σx², Σxy, Σy²):
 *   Second-order moments overflow u32 for large components (Σx² ≤ W² × count can
 *   reach 10¹² for a full-width text line). Computing covariance on the CPU from
 *   a single O(N) pass (using the centroid from GPU stats) is both correct and fast.
 *   See cpu/process.js for the two-pass PCA approach.
 */

/**
 * SHADER_STATS_CLEAR — Zero every slot in the stats buffer before accumulation.
 *
 * WHY A DEDICATED CLEAR SHADER:
 *   WebGPU has no built-in buffer-fill command for arbitrary values (only
 *   CommandEncoder.clearBuffer which zeros to 0 and requires COPY_DST usage).
 *   Using a compute shader to clear allows us to keep the stats buffer as pure
 *   STORAGE (no COPY_DST needed), and gives us the flexibility to clear any range.
 *
 * WHY atomicStore NOT A PLAIN WRITE:
 *   statsBuf is bound as array<atomic<u32>> in both shaders. The WGSL spec requires
 *   consistent use of atomic intrinsics for correctness; mixing plain and atomic
 *   accesses on the same binding is undefined behaviour.
 *
 * WORKGROUP SIZE 256 (1-D):
 *   The clear is a 1-D operation over K×3 elements; a flat 256-thread workgroup
 *   maps naturally to this without wasting 2-D tile structure.
 */
export const SHADER_STATS_CLEAR = `
struct P { n: u32, _a: u32, _b: u32, _c: u32 }
@group(0) @binding(0) var<storage, read_write> buf: array<atomic<u32>>;
@group(0) @binding(1) var<uniform>             p:   P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < p.n) { atomicStore(&buf[gid.x], 0u); }
}`;

/**
 * SHADER_STATS_ACCUM — Scatter pixel coordinates into per-component accumulators.
 *
 * WHY atomicAdd (not a per-thread local sum):
 *   Components span thousands of pixels spread across non-contiguous regions of the
 *   image. Grouping by component would require sorting pixels by label first — an
 *   expensive GPU sort. atomicAdd on per-component slots is the standard "GPU histogram"
 *   pattern: every thread independently contributes its pixel to the correct bucket.
 *
 * WHY gid.x >> p.csbits (coordinate scaling, see CS_BITS in config.js):
 *   Raw pixel x coordinates can reach 4096 for large images. The maximum u32 sum for
 *   a component of N pixels is x_max × N. For x_max=4096, N=4M: sum = 1.7×10¹⁰ which
 *   overflows u32 (max ≈ 4.3×10⁹). Right-shifting by CS_BITS=5 (dividing by 32) reduces
 *   x_scaled to ≤128, making even a full-image-spanning component's sum ≤ 5.1×10⁸.
 *   The resulting centroid has ±16 px precision — more than sufficient for PCA.
 *
 * WHY label[i] NOT dilated[i] DIRECTLY:
 *   The label buffer (compacted in cpu/labels.js) maps every dilated-foreground pixel to
 *   a compact index [0, K). Using lbl >= ncomp as a background guard means background
 *   pixels (lbl = 0xFFFFFFFF >> K for any realistic K) are silently skipped.
 */
export const SHADER_STATS_ACCUM = `
struct P { width: u32, height: u32, ncomp: u32, csbits: u32 }
@group(0) @binding(0) var<storage, read>       label: array<u32>;
@group(0) @binding(1) var<storage, read_write> stats: array<atomic<u32>>;
@group(0) @binding(2) var<uniform>             p:     P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let lbl = label[gid.y * p.width + gid.x];
  if (lbl >= p.ncomp) { return; }
  let base = lbl * 3u;
  atomicAdd(&stats[base + 0u], 1u);
  atomicAdd(&stats[base + 1u], gid.x >> p.csbits);
  atomicAdd(&stats[base + 2u], gid.y >> p.csbits);
}`;
