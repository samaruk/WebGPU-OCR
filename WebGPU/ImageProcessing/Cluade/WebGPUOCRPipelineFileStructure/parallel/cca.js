/**
 * parallel/cca.js — GPU-Accelerated Connected Component Analysis
 *
 * Implements parallel union-find (label propagation) CCA on binary images.
 *
 * Algorithm: Iterative label propagation using GPU compute
 *   1. Initialize: each foreground pixel gets its own label (flat index)
 *   2. Propagate: each pixel adopts the minimum label among its 4-neighbors
 *   3. Flatten: root compression so every pixel points to its root
 *   4. Repeat propagation until convergence
 *   5. Relabel compactly: [0, 1, ..., numComponents-1]
 *   6. Compute component statistics: bounding boxes, areas, centroids
 *
 * This uses the Playne-Krishnamurthy parallel CCA method adapted for WGSL.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Initialize labels
const SHADER_INIT_LABELS = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }

@group(0) @binding(0) var<uniform>            u:      U;
@group(0) @binding(1) var<storage,read>       binary: array<u32>;
@group(0) @binding(2) var<storage,read_write> labels: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  // Background gets UINT_MAX, foreground gets its own flat index
  labels[gid.x] = select(0xFFFFFFFFu, gid.x, binary[gid.x] != 0u);
}
`;

// Label propagation: each pixel takes min of its 4-neighbors' roots
const SHADER_PROPAGATE = /* wgsl */`
struct U {
  width:   u32,
  height:  u32,
  changed: u32,  // unused in GPU pass; convergence checked on CPU
  _p:      u32,
}

@group(0) @binding(0) var<uniform>            u:      U;
@group(0) @binding(1) var<storage,read>       src:    array<u32>;
@group(0) @binding(2) var<storage,read_write> dst:    array<u32>;
@group(0) @binding(3) var<storage,read_write> flag:   array<atomic<u32>>;  // [1] change flag

fn rootOf(labels: ptr<storage, array<u32>, read>, idx: u32) -> u32 {
  var r = idx;
  for (var i = 0u; i < 32u; i++) {   // max traversal depth
    let p = (*labels)[r];
    if (p >= 0xFFFFFFFEu || p == r) { break; }
    r = p;
  }
  return r;
}

fn readLabel(x: i32, y: i32) -> u32 {
  if (x < 0 || x >= i32(u.width) || y < 0 || y >= i32(u.height)) { return 0xFFFFFFFFu; }
  return src[u32(y) * u.width + u32(x)];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let idx = gid.y * u.width + gid.x;
  let cur = src[idx];
  if (cur >= 0xFFFFFFFEu) { dst[idx] = cur; return; }  // background

  // Min of 4-connected neighbors' labels
  var minLabel = cur;
  let n4 = array<vec2<i32>, 4>(
    vec2<i32>(-1, 0), vec2<i32>(1, 0),
    vec2<i32>(0, -1), vec2<i32>(0, 1),
  );
  for (var ni = 0u; ni < 4u; ni++) {
    let nx = i32(gid.x) + n4[ni].x;
    let ny = i32(gid.y) + n4[ni].y;
    let nl = readLabel(nx, ny);
    if (nl < 0xFFFFFFFEu && nl < minLabel) { minLabel = nl; }
  }

  dst[idx] = minLabel;
  if (minLabel != cur) { atomicStore(&flag[0], 1u); }
}
`;

// Root compression (path flattening)
const SHADER_FLATTEN = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }

@group(0) @binding(0) var<uniform>             u:      U;
@group(0) @binding(1) var<storage,read_write>  labels: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let myLabel = labels[gid.x];
  if (myLabel >= 0xFFFFFFFEu) { return; }

  // Chase to root
  var root = myLabel;
  for (var i = 0u; i < 64u; i++) {
    let parent = labels[root];
    if (parent >= 0xFFFFFFFEu || parent == root) { break; }
    root = parent;
  }
  labels[gid.x] = root;
}
`;

// Count unique labels → assign compact IDs
// Step 1: mark presence
const SHADER_MARK_ROOTS = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>             u:       U;
@group(0) @binding(1) var<storage,read>        labels:  array<u32>;
@group(0) @binding(2) var<storage,read_write>  isRoot:  array<u32>;  // 1 if this index is a root

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let lbl = labels[gid.x];
  if (lbl >= 0xFFFFFFFEu) { return; }
  if (labels[lbl] == lbl) {
    isRoot[lbl] = 1u;  // lbl is a root
  }
}
`;

// Prefix sum on isRoot → component IDs
const SHADER_PREFIX_SUM = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read_write> arr: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  // Naive serial prefix sum (fine for up to 4096 items in one thread)
  // For production, use a proper parallel scan
  if (gid.x != 0u) { return; }
  var acc = 0u;
  for (var i = 0u; i < u.n; i++) {
    let v = arr[i];
    arr[i] = acc;
    acc += v;
  }
}
`;

// Relabel each pixel with compact component ID
const SHADER_RELABEL = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>            u:          U;
@group(0) @binding(1) var<storage,read>       labels:     array<u32>;
@group(0) @binding(2) var<storage,read>       compactMap: array<u32>;  // root index → compact ID
@group(0) @binding(3) var<storage,read_write> dst:        array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let lbl = labels[gid.x];
  if (lbl >= 0xFFFFFFFEu) {
    dst[gid.x] = 0u;  // background = 0
    return;
  }
  dst[gid.x] = compactMap[lbl] + 1u;  // components start at 1
}
`;

// Compute per-component bounding boxes and areas via atomic operations
const SHADER_STATS = /* wgsl */`
struct U {
  n:          u32,
  width:      u32,
  maxComp:    u32,
  _p:         u32,
}

// Layout per component: [minX, minY, maxX, maxY, area] (5 u32 each)
@group(0) @binding(0) var<uniform>            u:      U;
@group(0) @binding(1) var<storage,read>       labels: array<u32>;   // compact labels
@group(0) @binding(2) var<storage,read_write> stats:  array<atomic<u32>>;  // [maxComp * 5]

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let c = labels[gid.x];
  if (c == 0u || c > u.maxComp) { return; }
  let x = gid.x % u.width;
  let y = gid.x / u.width;
  let base = (c - 1u) * 5u;
  atomicMin(&stats[base + 0u], x);
  atomicMin(&stats[base + 1u], y);
  atomicMax(&stats[base + 2u], x);
  atomicMax(&stats[base + 3u], y);
  atomicAdd(&stats[base + 4u], 1u);
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class CCAStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    const mk = (src, lbl) => gpuContext.createComputePipeline(
      gpuContext.createShaderModule(src, lbl), 'main');
    this._p = {
      init:      mk(SHADER_INIT_LABELS, 'cca:init'),
      propagate: mk(SHADER_PROPAGATE,   'cca:prop'),
      flatten:   mk(SHADER_FLATTEN,     'cca:flat'),
      markRoots: mk(SHADER_MARK_ROOTS,  'cca:roots'),
      prefixSum: mk(SHADER_PREFIX_SUM,  'cca:psum'),
      relabel:   mk(SHADER_RELABEL,     'cca:relabel'),
      stats:     mk(SHADER_STATS,       'cca:stats'),
    };
  }

  /**
   * Run connected component analysis on a binary image.
   * @param {Tensor} binaryTensor - [H*W] u32 (1=foreground)
   * @param {number} H, W
   * @param {Object} opts
   * @returns {Promise<CCAResult>}
   */
  async run(binaryTensor, H, W, opts = {}) {
    gpuContext.assertReady();
    await this._build();

    const { maxIterations = 32, maxComponents = 4096 } = opts;
    const N = H * W;
    const p = this._p;

    // ── 1. Initialize labels ───────────────────────────────────────────────
    const labelsA = new Tensor([N], 'u32', 0, 'cca:labA');
    const labelsB = new Tensor([N], 'u32', 0, 'cca:labB');
    {
      const u = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.init.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), binaryTensor.bindingEntry(1, true), labelsA.bindingEntry(2)],
      });
      gpuContext.dispatch(p.init, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── 2. Iterative propagation ───────────────────────────────────────────
    const flagTensor = Tensor.zeros([1], 'u32', 'cca:flag');
    let src = labelsA;
    let dst = labelsB;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Reset change flag
      gpuContext.writeBuffer(flagTensor.buffer, new Uint32Array([0]));

      const u = createUniformBuffer({ width: W, height: H, changed: 0, _p: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.propagate.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), src.bindingEntry(1, true), dst.bindingEntry(2), flagTensor.bindingEntry(3)],
      });
      gpuContext.dispatch(p.propagate, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);

      // Flatten paths in dst
      const uF = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bgF = gpuContext.device.createBindGroup({
        layout: p.flatten.getBindGroupLayout(0),
        entries: [uF.bindingEntry(0), dst.bindingEntry(1)],
      });
      gpuContext.dispatch(p.flatten, bgF, [Math.ceil(N / 256), 1, 1]);

      await gpuContext.sync();
      const flagData = await flagTensor.download();
      if (flagData[0] === 0) break;  // converged

      // Swap src/dst
      [src, dst] = [dst, src];
    }

    // After convergence, the current 'src' holds the final labels
    const finalLabels = src;

    // ── 3. Compact relabeling ──────────────────────────────────────────────
    const isRoot = Tensor.zeros([N], 'u32', 'cca:isRoot');
    {
      const u = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.markRoots.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), finalLabels.bindingEntry(1, true), isRoot.bindingEntry(2)],
      });
      gpuContext.dispatch(p.markRoots, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // Prefix sum to assign compact IDs (single-thread on GPU for simplicity)
    {
      const u = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.prefixSum.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), isRoot.bindingEntry(1)],
      });
      gpuContext.dispatch(p.prefixSum, bg, [1, 1, 1]);
    }

    // Read back number of components from last isRoot value
    await gpuContext.sync();
    const isRootData = await isRoot.download();
    const numComponents = isRootData[N - 1];  // after prefix sum, last entry = total count

    // Relabel
    const compactLabels = new Tensor([N], 'u32', 0, 'cca:compact');
    {
      const u = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.relabel.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), finalLabels.bindingEntry(1, true),
                  isRoot.bindingEntry(2, true), compactLabels.bindingEntry(3)],
      });
      gpuContext.dispatch(p.relabel, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── 4. Compute component statistics ───────────────────────────────────
    const actualMaxComp = Math.min(numComponents, maxComponents);
    // Initialize stats with sentinels for min(X,Y) and 0 for max(X,Y) and area
    const statInit = new Uint32Array(actualMaxComp * 5);
    for (let i = 0; i < actualMaxComp; i++) {
      statInit[i * 5 + 0] = W;  // minX = W (will be atomicMin'd down)
      statInit[i * 5 + 1] = H;  // minY = H
      statInit[i * 5 + 2] = 0;  // maxX = 0
      statInit[i * 5 + 3] = 0;  // maxY = 0
      statInit[i * 5 + 4] = 0;  // area
    }
    const statTensor = Tensor.fromData(statInit, [actualMaxComp * 5], 'u32', 'cca:stats');

    {
      const u = createUniformBuffer({ n: N, width: W, maxComp: actualMaxComp, _p: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.stats.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), compactLabels.bindingEntry(1, true), statTensor.bindingEntry(2)],
      });
      gpuContext.dispatch(p.stats, bg, [Math.ceil(N / 256), 1, 1]);
    }

    await gpuContext.sync();
    const statsData = await statTensor.download();

    // Parse component bounding boxes
    const components = [];
    for (let i = 0; i < actualMaxComp; i++) {
      const base = i * 5;
      const minX = statsData[base + 0];
      const minY = statsData[base + 1];
      const maxX = statsData[base + 2];
      const maxY = statsData[base + 3];
      const area = statsData[base + 4];
      if (area === 0) continue;
      components.push({
        id:   i + 1,
        bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
        area,
        centroid: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      });
    }

    // Cleanup
    labelsA.destroy(); labelsB.destroy();
    flagTensor.destroy(); isRoot.destroy(); statTensor.destroy();

    return {
      labelTensor: compactLabels,   // [H*W] u32, 0=background, 1..N=components
      numComponents: actualMaxComp,
      components,
    };
  }
}

/**
 * @typedef {Object} CCAComponent
 * @property {number} id
 * @property {{x,y,w,h}} bbox
 * @property {number} area
 * @property {{x,y}} centroid
 */

/**
 * @typedef {Object} CCAResult
 * @property {Tensor} labelTensor - [H*W] u32
 * @property {number} numComponents
 * @property {CCAComponent[]} components
 */
