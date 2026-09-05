import { wgsl } from './common.js';

/* ------------------------------------------------------------------ *
 * Stage 11 - connected components on the GPU.
 *
 * Naive neighbour-min label propagation needs one pass per pixel of component
 * diameter, which for a 2000px table rule means 2000 passes. Instead this is a
 * union-find (Komura-style equivalence): every foreground pixel starts as its
 * own root, LINK unions 8-neighbours by atomicMin on the *root*, and COMPRESS
 * path-compresses. Convergence is typically 3-5 iterations regardless of
 * component size.
 *
 * The label of a component is the smallest linear pixel index in it, so the
 * root index doubles as a stable id and as an address in the compaction map.
 * ------------------------------------------------------------------ */

// NOTE: kept as two snippets because `layout: 'auto'` derives the bind-group
// layout from resources *reachable from the entry point*. Pulling `unite` into
// a shader that never calls it would leave the `flag` binding out of the
// generated layout and the bind group would fail validation.
const FIND_ROOT = /* wgsl */ `
fn findRoot(start : u32) -> u32 {
  var r = start;
  for (var k = 0u; k < 128u; k = k + 1u) {
    let p = atomicLoad(&L[r]);
    if (p == r || p == INVALID) { break; }
    r = p;
  }
  return r;
}
`;

const UNITE = /* wgsl */ `
fn unite(a0 : u32, b0 : u32) {
  var a = a0;
  var b = b0;
  for (var k = 0u; k < 64u; k = k + 1u) {
    a = findRoot(a);
    b = findRoot(b);
    if (a == b) { return; }
    let mn = min(a, b);
    let mx = max(a, b);
    let old = atomicMin(&L[mx], mn);
    atomicStore(&flag[0], 1u);
    if (old == mx) { return; }   // we owned the write; done
    a = mn;                      // lost a race - retry against the winner
    b = old;
  }
}
`;

/** bindings: 1 L(atomic u32), 2 mask(f32)   f0 threshold */
export const CCA_INIT = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read_write> L : array<atomic<u32>>;
@group(0) @binding(2) var<storage, read> mask : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  if (mask[i] >= P.f0) {
    atomicStore(&L[i], i);
  } else {
    atomicStore(&L[i], INVALID);
  }
}
`);

/** bindings: 1 L(atomic), 2 flag(atomic[1]) */
export const CCA_LINK = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read_write> L : array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> flag : array<atomic<u32>>;
${FIND_ROOT}
${UNITE}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  if (atomicLoad(&L[i]) == INVALID) { return; }

  let x = i32(gid.x);
  let y = i32(gid.y);
  // Forward half of the 8-neighbourhood is enough: every edge is visited once
  // from one of its two endpoints.
  for (var k = 0u; k < 4u; k = k + 1u) {
    var dx = 1;
    var dy = 0;
    if (k == 1u) { dx = 0; dy = 1; }
    if (k == 2u) { dx = 1; dy = 1; }
    if (k == 3u) { dx = -1; dy = 1; }
    let nx = x + dx;
    let ny = y + dy;
    if (!inside(nx, ny)) { continue; }
    let j = pxIndex(u32(nx), u32(ny));
    if (atomicLoad(&L[j]) == INVALID) { continue; }
    unite(i, j);
  }
}
`);

/** bindings: 1 L(atomic) */
export const CCA_COMPRESS = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read_write> L : array<atomic<u32>>;
${FIND_ROOT}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  let l = atomicLoad(&L[i]);
  if (l == INVALID) { return; }
  let r = findRoot(i);
  if (r != l) { atomicStore(&L[i], r); }
}
`);

/**
 * Assign dense ids to roots.
 * bindings: 1 L(atomic), 2 map(u32), 3 counter(atomic[1]), 4 comps(atomic)
 * i0 = component capacity
 */
export const CCA_COMPACT = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read_write> L : array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> map : array<u32>;
@group(0) @binding(3) var<storage, read_write> counter : array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> comps : array<atomic<u32>>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  if (atomicLoad(&L[i]) != i) { return; }   // not a root
  let cid = atomicAdd(&counter[0], 1u);
  if (cid >= P.i0) { return; }              // capacity exceeded - drop
  map[i] = cid;
  atomicStore(&comps[cid * 8u + 7u], i);    // remember the root pixel index
}
`);

/**
 * Accumulate per-component bounding box / area / stroke overlap.
 * Slots: 0 minX  1 minY  2 maxX  3 maxY  4 area  5 strokeArea  6 inkSum  7 root
 * bindings: 1 L(atomic), 2 map, 3 comps(atomic), 4 mask, 5 stroke
 * i0 capacity   f0 mask threshold
 */
export const CCA_ACCUMULATE = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read_write> L : array<atomic<u32>>;
@group(0) @binding(2) var<storage, read> map : array<u32>;
@group(0) @binding(3) var<storage, read_write> comps : array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> mask : array<f32>;
@group(0) @binding(5) var<storage, read> stroke : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  let root = atomicLoad(&L[i]);
  if (root == INVALID) { return; }
  let cid = map[root];
  if (cid == INVALID || cid >= P.i0) { return; }

  let b = cid * 8u;
  atomicMin(&comps[b + 0u], gid.x);
  atomicMin(&comps[b + 1u], gid.y);
  atomicMax(&comps[b + 2u], gid.x);
  atomicMax(&comps[b + 3u], gid.y);
  atomicAdd(&comps[b + 4u], 1u);
  atomicAdd(&comps[b + 5u], u32(clamp(stroke[i], 0.0, 1.0) * 4.0 + 0.5));
  atomicAdd(&comps[b + 6u], u32(clamp(mask[i], 0.0, 1.0) * 8.0 + 0.5));
}
`);

/** Reset the component table. w = capacity (1D dispatch). */
export const CCA_RESET_COMPS = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read_write> comps : array<atomic<u32>>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w) { return; }
  let b = gid.x * 8u;
  atomicStore(&comps[b + 0u], INVALID);
  atomicStore(&comps[b + 1u], INVALID);
  atomicStore(&comps[b + 2u], 0u);
  atomicStore(&comps[b + 3u], 0u);
  atomicStore(&comps[b + 4u], 0u);
  atomicStore(&comps[b + 5u], 0u);
  atomicStore(&comps[b + 6u], 0u);
  atomicStore(&comps[b + 7u], INVALID);
}
`);
