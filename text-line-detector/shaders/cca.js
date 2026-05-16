/**
 * shaders/cca.js — WGSL shaders for GPU parallel Connected-Component Analysis.
 *
 * WHY A SEPARATE FILE:
 *   The three CCA shaders form a complete, self-contained algorithm (Parallel Union-Find)
 *   that is conceptually distinct from the image-processing shaders. Isolating them makes
 *   it easy to reason about the algorithm's correctness and tweak the iteration count.
 *
 * ALGORITHM OVERVIEW — Parallel Atomic Union-Find:
 *   Classic CPU union-find is serial: threads must synchronise on root lookup.
 *   The GPU version replaces this with atomic operations on a shared parent[] array,
 *   alternating two phases until convergence:
 *
 *   MERGE  — Each foreground pixel finds its root (rt()), then looks at 8 neighbours.
 *            For each foreground neighbour with a different root, it calls
 *            atomicMin(&parent[max(ri,rj)], min(ri,rj)).
 *            Because atomicMin only ever decreases parent[hi], label values can only
 *            go down, ruling out cycles in the tree.
 *
 *   COMPRESS — Each pixel follows its parent chain with path-halving (parent[x] ←
 *             grandparent[x]), flattening the tree so the next MERGE's rt() calls are
 *             shorter. After k cycles, effective reach grows as ~2^k due to compression,
 *             so 30 cycles comfortably handles blobs thousands of pixels wide.
 *
 * CORRECTNESS GUARANTEE:
 *   Two pixels end up with the same root iff they are 8-connected in the foreground mask.
 *   atomicMin on a u32 is safe because pixel indices are always ≥ 0 and 0xFFFFFFFF is the
 *   sentinel for background — background pixels are never written by MERGE.
 */

/**
 * SHADER_CCA_INIT — Seed the parent array from the dilated binary mask.
 *
 * WHY NECESSARY:
 *   The union-find tree must start with each foreground pixel being its own root
 *   (parent[i] = i) and background pixels marked with the sentinel (0xFFFFFFFF).
 *   This invariant is what lets rt() stop early (px == x means root reached).
 *
 * WHY atomicStore (not a plain write):
 *   parentBuf is declared as array<atomic<u32>> in all three CCA shaders. WebGPU requires
 *   all accesses to an atomic-typed binding to go through atomic intrinsics; mixing plain
 *   and atomic accesses is undefined behaviour in WGSL.
 */
export const SHADER_CCA_INIT = `
struct P { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read_write> parent: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read>       mask:   array<u32>;
@group(0) @binding(2) var<uniform>             p:      P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let i = gid.y * p.width + gid.x;
  if (mask[i] == 0u) { atomicStore(&parent[i], 0xFFFFFFFFu); }
  else               { atomicStore(&parent[i], i); }
}`;

/**
 * SHADER_CCA_MERGE — 8-neighbour parallel union step using atomicMin.
 *
 * WHY rt() FOLLOWS THE CHAIN WITH atomicLoad:
 *   parent[x] may be updated concurrently by other threads. atomicLoad ensures we
 *   always see a consistent (sequentially consistent) value. A plain read could observe
 *   a torn 64-bit write on some hardware (though u32 is usually atomic by default,
 *   the WGSL spec requires atomic intrinsics for correctness guarantees).
 *
 * WHY 48 ITERATIONS IN rt():
 *   After COMPRESS, most chains are ≤ 1 link long. 48 is a conservative upper bound
 *   that handles the worst-case chain length for any realistically sized image while
 *   keeping register pressure manageable.
 *
 * WHY atomicMin(&parent[hi], lo) AND NOT parent[lo]:
 *   We want the smaller index to become the root (stable, deterministic). Writing to
 *   parent[hi] = lo (larger ← smaller) always decreases the larger root's parent,
 *   which can never create a cycle. Writing to parent[lo] could cause the root to point
 *   away from itself, creating a cycle.
 */
export const SHADER_CCA_MERGE = `
struct P { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read_write> parent: array<atomic<u32>>;
@group(0) @binding(1) var<uniform>             p:      P;
fn rt(s: u32) -> u32 {
  var x = s;
  for (var k = 0u; k < 48u; k++) {
    let px = atomicLoad(&parent[x]);
    if (px == x || px == 0xFFFFFFFFu) { return px; }
    x = px;
  }
  return x;
}
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let x = gid.x; let y = gid.y;
  let ri = rt(y * p.width + x);
  if (ri == 0xFFFFFFFFu) { return; }
  for (var dy: i32 = -1; dy <= 1; dy++) {
    for (var dx: i32 = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let nx = i32(x)+dx; let ny = i32(y)+dy;
      if (nx < 0 || ny < 0 || u32(nx) >= p.width || u32(ny) >= p.height) { continue; }
      let rj = rt(u32(ny) * p.width + u32(nx));
      if (rj == 0xFFFFFFFFu || rj == ri) { continue; }
      let lo = min(ri, rj); let hi = max(ri, rj);
      atomicMin(&parent[hi], lo);
    }
  }
}`;

/**
 * SHADER_CCA_COMPRESS — Path-halving compression of the union-find tree.
 *
 * WHY NECESSARY:
 *   After MERGE, a foreground pixel's parent may point several hops away from its
 *   component root. Without compression, rt() in subsequent MERGE passes walks
 *   those long chains, wasting GPU cycles and producing incorrect intermediate roots.
 *
 * HOW PATH-HALVING WORKS:
 *   For pixel i with chain i → cur → par → gpar → … → root:
 *     atomicStore(&parent[cur], gpar)   (skip one level)
 *     cur = gpar                         (follow the shortened chain)
 *   Each iteration halves the chain length. After 16 inner iterations this handles
 *   chains of up to 2^16 = 65 536 pixels long — far more than any realistic blob.
 *
 * WHY atomicStore INSTEAD OF PLAIN WRITE:
 *   parent is array<atomic<u32>>; all accesses must use atomic intrinsics (WGSL requirement).
 *   Concurrent path-halving by different threads is safe: races produce suboptimal but
 *   never incorrect compression — a thread may see a stale (not yet compressed) grandparent,
 *   but the next COMPRESS call will correct it.
 */
export const SHADER_CCA_COMPRESS = `
struct P { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read_write> parent: array<atomic<u32>>;
@group(0) @binding(1) var<uniform>             p:      P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let i = gid.y * p.width + gid.x;
  var cur = atomicLoad(&parent[i]);
  if (cur == 0xFFFFFFFFu || cur == i) { return; }
  for (var k = 0u; k < 16u; k++) {
    let par = atomicLoad(&parent[cur]);
    if (par == cur || par == 0xFFFFFFFFu) { atomicStore(&parent[i], cur); return; }
    let gpar = atomicLoad(&parent[par]);
    atomicStore(&parent[cur], gpar);
    cur = gpar;
    if (cur == i) { return; }
  }
  atomicStore(&parent[i], cur);
}`;
