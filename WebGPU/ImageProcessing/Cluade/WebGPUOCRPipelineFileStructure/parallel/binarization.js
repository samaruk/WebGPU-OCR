/**
 * parallel/binarization.js — GPU Parallel Binarization
 *
 * Provides multiple binarization algorithms running in parallel GPU compute:
 *   1. Otsu's method (global threshold via histogram analysis)
 *   2. Sauvola adaptive thresholding (local mean + std)
 *   3. Niblack adaptive thresholding
 *   4. Bradley local thresholding (integral image based)
 *
 * Each method is available as a separate pipeline.
 * The caller can run multiple in parallel and pick the best result
 * based on the textness map or IQA flags.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Histogram accumulation (256 bins) for Otsu
const SHADER_HISTOGRAM = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }

@group(0) @binding(0) var<uniform>             u:    U;
@group(0) @binding(1) var<storage,read>        luma: array<f32>;
@group(0) @binding(2) var<storage,read_write>  hist: array<atomic<u32>>;  // [256]

var<workgroup> wgHist: array<atomic<u32>, 256>;

@compute @workgroup_size(256)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id)  lid: vec3<u32>,
) {
  atomicStore(&wgHist[lid.x], 0u);
  workgroupBarrier();

  if (gid.x < u.n) {
    let bin = u32(clamp(luma[gid.x], 0.0, 1.0) * 255.0);
    atomicAdd(&wgHist[bin], 1u);
  }
  workgroupBarrier();

  atomicAdd(&hist[lid.x], atomicLoad(&wgHist[lid.x]));
}
`;

// Otsu threshold computation from histogram (CPU-friendly: read histogram, compute on CPU)
// This shader just produces the histogram; Otsu analysis runs on CPU.

// Sauvola adaptive binarization
// threshold(x,y) = mean * (1 + k * (std / R - 1))
// k ≈ 0.5, R = 128 (dynamic range half-max for luma)
const SHADER_SAUVOLA = /* wgsl */`
struct U {
  width:    u32,
  height:   u32,
  radius:   u32,
  k:        f32,
  R:        f32,
  invert:   u32,
  _p0:      u32,
  _p1:      u32,
}

@group(0) @binding(0) var<uniform>            u:      U;
@group(0) @binding(1) var<storage,read>       luma:   array<f32>;
@group(0) @binding(2) var<storage,read_write> binary: array<u32>;

fn rd(x: i32, y: i32) -> f32 {
  return luma[u32(clamp(y, 0, i32(u.height)-1)) * u.width
            + u32(clamp(x, 0, i32(u.width)-1))];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let r = i32(u.radius);

  var sum  = 0.0;
  var sum2 = 0.0;
  var cnt  = 0.0;

  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let v = rd(x+dx, y+dy);
      sum  += v;
      sum2 += v * v;
      cnt  += 1.0;
    }
  }

  let mean  = sum / cnt;
  let var_  = max(0.0, sum2/cnt - mean*mean);
  let std   = sqrt(var_);
  let thresh = mean * (1.0 + u.k * (std / u.R - 1.0));

  let val = luma[gid.y * u.width + gid.x];
  var bin = select(0u, 1u, val >= thresh);
  if (u.invert != 0u) { bin = 1u - bin; }
  binary[gid.y * u.width + gid.x] = bin;
}
`;

// Niblack binarization
// threshold(x,y) = mean + k * std   (k ≈ -0.2 for text, negative bias toward foreground)
const SHADER_NIBLACK = /* wgsl */`
struct U {
  width:  u32,
  height: u32,
  radius: u32,
  k:      f32,
  invert: u32,
  _p0:    u32,
  _p1:    u32,
  _p2:    u32,
}

@group(0) @binding(0) var<uniform>            u:      U;
@group(0) @binding(1) var<storage,read>       luma:   array<f32>;
@group(0) @binding(2) var<storage,read_write> binary: array<u32>;

fn rd(x: i32, y: i32) -> f32 {
  return luma[u32(clamp(y, 0, i32(u.height)-1)) * u.width
            + u32(clamp(x, 0, i32(u.width)-1))];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let r = i32(u.radius);

  var sum  = 0.0;
  var sum2 = 0.0;
  var cnt  = 0.0;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let v = rd(x+dx, y+dy);
      sum  += v;
      sum2 += v*v;
      cnt  += 1.0;
    }
  }
  let mean = sum / cnt;
  let std  = sqrt(max(0.0, sum2/cnt - mean*mean));
  let thresh = mean + u.k * std;
  let val = luma[gid.y * u.width + gid.x];
  var bin = select(0u, 1u, val >= thresh);
  if (u.invert != 0u) { bin = 1u - bin; }
  binary[gid.y * u.width + gid.x] = bin;
}
`;

// Compute 2D integral image (prefix sum) for fast local area statistics
const SHADER_INTEGRAL_H = /* wgsl */`
struct U { width: u32, height: u32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:    U;
@group(0) @binding(1) var<storage,read>       src:  array<f32>;
@group(0) @binding(2) var<storage,read_write> dst:  array<f32>;  // horizontal prefix sum

@compute @workgroup_size(1, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let y = gid.y;
  if (y >= u.height) { return; }
  var acc = 0.0;
  for (var x = 0u; x < u.width; x++) {
    acc += src[y * u.width + x];
    dst[y * u.width + x] = acc;
  }
}
`;

const SHADER_INTEGRAL_V = /* wgsl */`
struct U { width: u32, height: u32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read_write> dst: array<f32>;  // vertical prefix sum (in-place)

@compute @workgroup_size(16, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  if (x >= u.width) { return; }
  var acc = 0.0;
  for (var y = 0u; y < u.height; y++) {
    acc += dst[y * u.width + x];
    dst[y * u.width + x] = acc;
  }
}
`;

// Bradley local threshold: threshold = (local_mean * (1 - t))
// Local mean computed from integral image
const SHADER_BRADLEY = /* wgsl */`
struct U {
  width:  u32,
  height: u32,
  radius: u32,
  t:      f32,   // threshold fraction (e.g. 0.15)
  invert: u32,
  _p0:    u32,
  _p1:    u32,
  _p2:    u32,
}

@group(0) @binding(0) var<uniform>            u:       U;
@group(0) @binding(1) var<storage,read>       luma:    array<f32>;
@group(0) @binding(2) var<storage,read>       intImg:  array<f32>;  // 2D integral image
@group(0) @binding(3) var<storage,read_write> binary:  array<u32>;

fn safeInteg(x: i32, y: i32) -> f32 {
  if (x < 0 || y < 0) { return 0.0; }
  let cx = u32(min(x, i32(u.width)  - 1));
  let cy = u32(min(y, i32(u.height) - 1));
  return intImg[cy * u.width + cx];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let r = i32(u.radius);

  let x1 = x - r - 1;
  let y1 = y - r - 1;
  let x2 = x + r;
  let y2 = y + r;

  // Area sum via inclusion-exclusion
  let s = safeInteg(x2,y2) - safeInteg(x1,y2) - safeInteg(x2,y1) + safeInteg(x1,y1);
  let count = f32((x2 - x1) * (y2 - y1));
  let mean  = s / count;
  let thresh = mean * (1.0 - u.t);

  let val = luma[gid.y * u.width + gid.x];
  var bin = select(0u, 1u, val * 255.0 >= thresh * 255.0);
  if (u.invert != 0u) { bin = 1u - bin; }
  binary[gid.y * u.width + gid.x] = bin;
}
`;

// Combine multiple binary maps via majority vote
const SHADER_MAJORITY_VOTE = /* wgsl */`
struct U { n: u32, numMaps: u32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:      U;
@group(0) @binding(1) var<storage,read>       maps:   array<u32>;  // [numMaps * n] concatenated
@group(0) @binding(2) var<storage,read_write> result: array<u32>;  // [n]

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  var votes = 0u;
  for (var m = 0u; m < u.numMaps; m++) {
    votes += maps[m * u.n + gid.x];
  }
  result[gid.x] = select(0u, 1u, votes * 2u >= u.numMaps);
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class BinarizationStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    const mk = (src, lbl) => gpuContext.createComputePipeline(
      gpuContext.createShaderModule(src, lbl), 'main');
    this._p = {
      histogram:    mk(SHADER_HISTOGRAM,    'bin:hist'),
      sauvola:      mk(SHADER_SAUVOLA,      'bin:sauvola'),
      niblack:      mk(SHADER_NIBLACK,      'bin:niblack'),
      integralH:    mk(SHADER_INTEGRAL_H,   'bin:intH'),
      integralV:    mk(SHADER_INTEGRAL_V,   'bin:intV'),
      bradley:      mk(SHADER_BRADLEY,      'bin:bradley'),
      majorityVote: mk(SHADER_MAJORITY_VOTE,'bin:vote'),
    };
  }

  /**
   * Run Sauvola binarization.
   * @param {Tensor} lumaTensor - [H, W] f32
   * @param {number} H, W
   * @param {Object} opts
   * @returns {Tensor} binary [H*W] u32
   */
  async sauvola(lumaTensor, H, W, opts = {}) {
    gpuContext.assertReady();
    await this._build();

    const { radius = 15, k = 0.5, R = 0.5, invert = false } = opts;
    const binary = new Tensor([H * W], 'u32', 0, 'bin:sauvola');
    const u = createUniformBuffer({ width: W, height: H, radius, k, R, invert: invert ? 1 : 0, _p0: 0, _p1: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.sauvola.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), lumaTensor.bindingEntry(1, true), binary.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.sauvola, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    return binary;
  }

  /**
   * Run Niblack binarization.
   */
  async niblack(lumaTensor, H, W, opts = {}) {
    gpuContext.assertReady();
    await this._build();

    const { radius = 15, k = -0.2, invert = false } = opts;
    const binary = new Tensor([H * W], 'u32', 0, 'bin:niblack');
    const u = createUniformBuffer({ width: W, height: H, radius, k, invert: invert ? 1 : 0, _p0: 0, _p1: 0, _p2: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.niblack.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), lumaTensor.bindingEntry(1, true), binary.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.niblack, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    return binary;
  }

  /**
   * Build 2D integral image.
   */
  async buildIntegralImage(lumaTensor, H, W) {
    gpuContext.assertReady();
    await this._build();

    const intImg = new Tensor([H * W], 'f32', 0, 'bin:integral');
    const u = createUniformBuffer({ width: W, height: H, _p0: 0, _p1: 0 });

    // Horizontal prefix sum
    const bgH = gpuContext.device.createBindGroup({
      layout: this._p.integralH.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), lumaTensor.bindingEntry(1, true), intImg.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.integralH, bgH, [1, Math.ceil(H / 16), 1]);

    // Vertical prefix sum (in-place)
    const bgV = gpuContext.device.createBindGroup({
      layout: this._p.integralV.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), intImg.bindingEntry(1)],
    });
    gpuContext.dispatch(this._p.integralV, bgV, [Math.ceil(W / 16), 1, 1]);

    return intImg;
  }

  /**
   * Run Bradley binarization (uses integral image).
   */
  async bradley(lumaTensor, H, W, opts = {}) {
    gpuContext.assertReady();
    await this._build();

    const { radius = 20, t = 0.15, invert = false } = opts;
    const intImg = await this.buildIntegralImage(lumaTensor, H, W);
    const binary = new Tensor([H * W], 'u32', 0, 'bin:bradley');

    const u = createUniformBuffer({ width: W, height: H, radius, t, invert: invert ? 1 : 0, _p0: 0, _p1: 0, _p2: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.bradley.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), lumaTensor.bindingEntry(1, true),
                intImg.bindingEntry(2, true), binary.bindingEntry(3)],
    });
    gpuContext.dispatch(this._p.bradley, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    intImg.destroy();
    return binary;
  }

  /**
   * Compute global Otsu threshold via histogram.
   * @returns {number} - threshold value in [0, 1]
   */
  async otsuThreshold(lumaTensor, H, W) {
    gpuContext.assertReady();
    await this._build();

    const N = H * W;
    const histTensor = Tensor.zeros([256], 'u32', 'bin:hist');
    const u = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.histogram.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), lumaTensor.bindingEntry(1, true), histTensor.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.histogram, bg, [Math.ceil(N / 256), 1, 1]);
    await gpuContext.sync();
    const histData = await histTensor.download();
    histTensor.destroy();
    return computeOtsuCPU(histData, N);
  }

  /**
   * Run all three adaptive methods and combine via majority vote.
   * @returns {Promise<Tensor>} combined binary [H*W] u32
   */
  async runEnsemble(lumaTensor, H, W, opts = {}) {
    gpuContext.assertReady();
    await this._build();

    const [s, ni, br] = await Promise.all([
      this.sauvola(lumaTensor, H, W, opts),
      this.niblack(lumaTensor, H, W, opts),
      this.bradley(lumaTensor, H, W, opts),
    ]);

    // Pack all 3 maps into one tensor
    const N = H * W;
    const combined = new Tensor([N], 'u32', 0, 'bin:ensemble_in');
    const result   = new Tensor([N], 'u32', 0, 'bin:ensemble_out');

    // Copy each map into combined (offset by N each)
    const enc = gpuContext.device.createCommandEncoder();
    enc.copyBufferToBuffer(s.buffer,  0, combined.buffer, 0,      N * 4);
    enc.copyBufferToBuffer(ni.buffer, 0, combined.buffer, N * 4,  N * 4);
    enc.copyBufferToBuffer(br.buffer, 0, combined.buffer, N * 8,  N * 4);
    gpuContext.queue.submit([enc.finish()]);
    combined.shape = [3 * N];

    const u = createUniformBuffer({ n: N, numMaps: 3, _p0: 0, _p1: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.majorityVote.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), combined.bindingEntry(1, true), result.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.majorityVote, bg, [Math.ceil(N / 256), 1, 1]);

    s.destroy(); ni.destroy(); br.destroy(); combined.destroy();
    return result;
  }
}

// ─── Otsu's method (CPU, from histogram) ─────────────────────────────────────

function computeOtsuCPU(hist, N) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, wF = 0;
  let maxVar = 0, threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = N - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) ** 2;

    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }

  return threshold / 255.0;
}
