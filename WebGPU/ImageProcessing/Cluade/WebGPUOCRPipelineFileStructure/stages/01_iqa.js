/**
 * 01_iqa.js — Image Quality Assessment
 *
 * Runs a GPU-accelerated quality analysis pass over the raw input image.
 * Outputs:
 *   - blur score (Laplacian variance)
 *   - exposure score (mean luminance + clipping ratios)
 *   - noise score (local variance)
 *   - contrast score (global RMS contrast)
 *   - iqaResult: { score: 0-1, flags: Set<string>, recommendations: string[] }
 *
 * All heavy work runs in compute shaders; the final scalar metrics are
 * read back to CPU for routing decisions in main.js.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ────────────────────────────────────────────────────────────────────

const SHADER_LUMINANCE = /* wgsl */`
struct Uniforms {
  width:  u32,
  height: u32,
  stride: u32,
  _pad:   u32,
}

@group(0) @binding(0) var<uniform>          u: Uniforms;
@group(0) @binding(1) var<storage,read>     pixels: array<u32>;   // packed RGBA8
@group(0) @binding(2) var<storage,read_write> luma: array<f32>;   // [H*W]

fn unpackRGB(packed: u32) -> vec3<f32> {
  let r = f32((packed >>  0u) & 0xFFu) / 255.0;
  let g = f32((packed >>  8u) & 0xFFu) / 255.0;
  let b = f32((packed >> 16u) & 0xFFu) / 255.0;
  return vec3<f32>(r, g, b);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let idx = gid.y * u.stride + gid.x;
  let rgb = unpackRGB(pixels[idx]);
  // BT.601 luma
  luma[gid.y * u.width + gid.x] = dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
}
`;

const SHADER_LAPLACIAN = /* wgsl */`
struct Uniforms {
  width:  u32,
  height: u32,
  _pad0:  u32,
  _pad1:  u32,
}

@group(0) @binding(0) var<uniform>          u: Uniforms;
@group(0) @binding(1) var<storage,read>     luma: array<f32>;
@group(0) @binding(2) var<storage,read_write> lapSq: array<f32>;  // Laplacian^2

fn safeRead(x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(u.width)  - 1);
  let cy = clamp(y, 0, i32(u.height) - 1);
  return luma[u32(cy) * u.width + u32(cx)];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  // 3x3 Laplacian kernel
  let lap =
      safeRead(x-1, y-1) *  0.0 + safeRead(x, y-1) * -1.0 + safeRead(x+1, y-1) *  0.0
    + safeRead(x-1, y  ) * -1.0 + safeRead(x, y  ) *  4.0 + safeRead(x+1, y  ) * -1.0
    + safeRead(x-1, y+1) *  0.0 + safeRead(x, y+1) * -1.0 + safeRead(x+1, y+1) *  0.0;
  lapSq[gid.y * u.width + gid.x] = lap * lap;
}
`;

// Parallel reduction: sum a float array into a single atomic accumulator
// Done in two passes: block sums → final sum
const SHADER_REDUCE_SUM = /* wgsl */`
struct Uniforms {
  n:    u32,
  _p0:  u32,
  _p1:  u32,
  _p2:  u32,
}

@group(0) @binding(0) var<uniform>            u: Uniforms;
@group(0) @binding(1) var<storage,read>       src: array<f32>;
@group(0) @binding(2) var<storage,read_write> dst: array<atomic<u32>>; // bitcast accumulate

var<workgroup> wgSum: array<f32, 256>;

@compute @workgroup_size(256)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id)  lid: vec3<u32>,
  @builtin(workgroup_id)         wid: vec3<u32>,
) {
  let i = gid.x;
  wgSum[lid.x] = select(0.0, src[i], i < u.n);
  workgroupBarrier();

  // Tree reduction
  for (var stride = 128u; stride > 0u; stride >>= 1u) {
    if (lid.x < stride) {
      wgSum[lid.x] += wgSum[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    // Write block sum as f32 bits into dst[workgroup_id]
    // dst is pre-zeroed; we use a separate per-block output array
    let bits = bitcast<u32>(wgSum[0]);
    atomicStore(&dst[wid.x], bits);
  }
}
`;

// Local variance estimation shader (noise)
const SHADER_LOCAL_VAR = /* wgsl */`
struct Uniforms {
  width:  u32,
  height: u32,
  radius: u32,
  _pad:   u32,
}

@group(0) @binding(0) var<uniform>            u: Uniforms;
@group(0) @binding(1) var<storage,read>       luma: array<f32>;
@group(0) @binding(2) var<storage,read_write> varOut: array<f32>;

fn safeRead(x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(u.width)  - 1);
  let cy = clamp(y, 0, i32(u.height) - 1);
  return luma[u32(cy) * u.width + u32(cx)];
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
      let v = safeRead(x + dx, y + dy);
      sum  += v;
      sum2 += v * v;
      cnt  += 1.0;
    }
  }

  let mean = sum / cnt;
  let variance = (sum2 / cnt) - (mean * mean);
  varOut[gid.y * u.width + gid.x] = max(0.0, variance);
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class IQAStage {
  constructor() {
    this._pipelines = null;
  }

  async _buildPipelines() {
    if (this._pipelines) return;
    const dev = gpuContext.device;

    const lumMod = gpuContext.createShaderModule(SHADER_LUMINANCE, 'iqa:luma');
    const lapMod = gpuContext.createShaderModule(SHADER_LAPLACIAN, 'iqa:laplacian');
    const redMod = gpuContext.createShaderModule(SHADER_REDUCE_SUM, 'iqa:reduce');
    const varMod = gpuContext.createShaderModule(SHADER_LOCAL_VAR,  'iqa:localvar');

    this._pipelines = {
      luma:      gpuContext.createComputePipeline(lumMod, 'main'),
      laplacian: gpuContext.createComputePipeline(lapMod, 'main'),
      reduce:    gpuContext.createComputePipeline(redMod, 'main'),
      localVar:  gpuContext.createComputePipeline(varMod, 'main'),
    };
  }

  /**
   * Run IQA on a packed RGBA8 GPU tensor.
   * @param {Tensor} imageTensor - shape [H, W], dtype u32, packed RGBA8
   * @returns {Promise<IQAResult>}
   */
  async run(imageTensor) {
    gpuContext.assertReady();
    await this._buildPipelines();

    const [H, W] = imageTensor.shape;
    const N = H * W;
    const p = this._pipelines;

    // ── Step 1: Compute luminance ──────────────────────────────────────────
    const lumaTensor = new Tensor([H, W], 'f32', 0, 'iqa:luma');
    {
      const uniforms = createUniformBuffer({ width: W, height: H, stride: W, _pad: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.luma.getBindGroupLayout(0),
        entries: [
          uniforms.bindingEntry(0),
          imageTensor.bindingEntry(1, true),
          lumaTensor.bindingEntry(2, false),
        ],
      });
      gpuContext.dispatch(p.luma, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    }

    // ── Step 2: Laplacian variance (blur score) ────────────────────────────
    const lapSqTensor = new Tensor([H, W], 'f32', 0, 'iqa:lapsq');
    {
      const uniforms = createUniformBuffer({ width: W, height: H, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.laplacian.getBindGroupLayout(0),
        entries: [
          uniforms.bindingEntry(0),
          lumaTensor.bindingEntry(1, true),
          lapSqTensor.bindingEntry(2, false),
        ],
      });
      gpuContext.dispatch(p.laplacian, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    }

    // ── Step 3: Local variance (noise score) ──────────────────────────────
    const varTensor = new Tensor([H, W], 'f32', 0, 'iqa:var');
    {
      const uniforms = createUniformBuffer({ width: W, height: H, radius: 3, _pad: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.localVar.getBindGroupLayout(0),
        entries: [
          uniforms.bindingEntry(0),
          lumaTensor.bindingEntry(1, true),
          varTensor.bindingEntry(2, false),
        ],
      });
      gpuContext.dispatch(p.localVar, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    }

    // ── Step 4: CPU-side scalar metrics ───────────────────────────────────
    await gpuContext.sync();

    const lumaData  = await lumaTensor.download();   // Float32Array [H*W]
    const lapData   = await lapSqTensor.download();
    const varData   = await varTensor.download();

    const meanLuma   = arrayMean(lumaData);
    const lapVar     = arrayMean(lapData);            // Laplacian variance → blur
    const meanNoise  = arrayMean(varData);
    const globalVar  = arrayVariance(lumaData, meanLuma);

    // Exposure clipping
    let overExposed  = 0;
    let underExposed = 0;
    for (let i = 0; i < lumaData.length; i++) {
      if (lumaData[i] > 0.95) overExposed++;
      if (lumaData[i] < 0.05) underExposed++;
    }
    const overRatio  = overExposed  / N;
    const underRatio = underExposed / N;

    // ── Step 5: Score & flag ───────────────────────────────────────────────
    const blurScore     = clamp01(lapVar / 500.0);       // >0.1 = acceptably sharp
    const exposureScore = 1.0 - clamp01((overRatio + underRatio) * 5.0);
    const noiseScore    = clamp01(1.0 - meanNoise * 200.0);
    const contrastScore = clamp01(Math.sqrt(globalVar) * 5.0);

    const overallScore = (blurScore * 0.40 + exposureScore * 0.25 +
                          noiseScore * 0.20  + contrastScore * 0.15);

    const flags = new Set();
    if (blurScore     < 0.25) flags.add('blurry');
    if (exposureScore < 0.50) flags.add('bad_exposure');
    if (noiseScore    < 0.30) flags.add('noisy');
    if (contrastScore < 0.25) flags.add('low_contrast');

    const recommendations = [];
    if (flags.has('blurry'))        recommendations.push('Apply sharpening filter before recognition');
    if (flags.has('bad_exposure'))  recommendations.push('Apply CLAHE or histogram equalization');
    if (flags.has('noisy'))         recommendations.push('Apply bilateral or Gaussian denoising');
    if (flags.has('low_contrast'))  recommendations.push('Increase contrast via gamma correction');

    // Cleanup intermediates
    lumaTensor.destroy();
    lapSqTensor.destroy();
    varTensor.destroy();

    return {
      score:          overallScore,
      blurScore,
      exposureScore,
      noiseScore,
      contrastScore,
      meanLuminance:  meanLuma,
      overExposedRatio:  overRatio,
      underExposedRatio: underRatio,
      flags,
      recommendations,
      acceptable: overallScore >= 0.45,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function arrayMean(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function arrayVariance(arr, mean) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - mean;
    sum += d * d;
  }
  return sum / arr.length;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/**
 * @typedef {Object} IQAResult
 * @property {number} score - overall quality 0-1
 * @property {number} blurScore
 * @property {number} exposureScore
 * @property {number} noiseScore
 * @property {number} contrastScore
 * @property {number} meanLuminance
 * @property {number} overExposedRatio
 * @property {number} underExposedRatio
 * @property {Set<string>} flags
 * @property {string[]} recommendations
 * @property {boolean} acceptable
 */
