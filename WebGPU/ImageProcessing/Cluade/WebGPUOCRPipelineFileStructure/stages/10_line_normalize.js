/**
 * 10_line_normalize.js — Text Line Normalization
 *
 * Normalizes each cropped text line to a fixed height while preserving
 * aspect ratio, then pads to a fixed width with a white background.
 *
 * Standard OCR target: height=32px (or 48px), width=variable up to maxW.
 *
 * GPU pipeline:
 *   1. Bilinear resize to target height (aspect-preserving)
 *   2. Pad right edge with white
 *   3. Grayscale conversion + contrast normalization for recognition
 *   4. Pack into batched tensor [N, C, H, W] for the OCR model
 *
 * Grayscale is used for the recognition model (saves ~3× memory vs RGB).
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Bilinear resize
const SHADER_RESIZE = /* wgsl */`
struct U {
  srcW: u32, srcH: u32,
  dstW: u32, dstH: u32,
}

@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       src: array<u32>;   // RGBA8
@group(0) @binding(2) var<storage,read_write> dst: array<u32>;   // RGBA8

fn sampleBilinear(fx: f32, fy: f32) -> u32 {
  let x0 = i32(floor(fx));
  let y0 = i32(floor(fy));
  let ax = fx - floor(fx);
  let ay = fy - floor(fy);

  fn clampPx(x: i32, y: i32) -> vec4<f32> {
    let cx = u32(clamp(x, 0, i32(u.srcW)-1));
    let cy = u32(clamp(y, 0, i32(u.srcH)-1));
    let p  = src[cy * u.srcW + cx];
    return vec4<f32>(f32(p & 0xFFu), f32((p>>8u)&0xFFu), f32((p>>16u)&0xFFu), 255.0);
  }

  let p00 = clampPx(x0,   y0);
  let p10 = clampPx(x0+1, y0);
  let p01 = clampPx(x0,   y0+1);
  let p11 = clampPx(x0+1, y0+1);
  let m   = mix(mix(p00,p10,ax), mix(p01,p11,ax), ay);
  let r = u32(clamp(m.x, 0.0, 255.0));
  let g = u32(clamp(m.y, 0.0, 255.0));
  let b = u32(clamp(m.z, 0.0, 255.0));
  return r | (g<<8u) | (b<<16u) | 0xFF000000u;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.dstW || gid.y >= u.dstH) { return; }
  let fx = f32(gid.x) * f32(u.srcW) / f32(u.dstW);
  let fy = f32(gid.y) * f32(u.srcH) / f32(u.dstH);
  dst[gid.y * u.dstW + gid.x] = sampleBilinear(fx, fy);
}
`;

// Convert RGBA crop to grayscale float + contrast normalization
// Output: float tensor [1, H, W] normalized to [-1, 1] with per-image mean/std
const SHADER_TO_GRAY_NORM = /* wgsl */`
struct U {
  srcW:   u32,
  srcH:   u32,
  padW:   u32,  // full canvas width (srcW + padding)
  _p:     u32,
}

@group(0) @binding(0) var<uniform>            u:    U;
@group(0) @binding(1) var<storage,read>       src:  array<u32>;   // RGBA8 [srcH * srcW]
@group(0) @binding(2) var<storage,read>       stat: array<f32>;   // [mean, std]
@group(0) @binding(3) var<storage,read_write> dst:  array<f32>;   // [padH * padW]

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.padW || gid.y >= u.srcH) { return; }
  let mean = stat[0];
  let std  = max(stat[1], 1e-6);
  var gray = 1.0;  // white for padding regions
  if (gid.x < u.srcW) {
    let p = src[gid.y * u.srcW + gid.x];
    let r = f32((p >>  0u) & 0xFFu) / 255.0;
    let g = f32((p >>  8u) & 0xFFu) / 255.0;
    let b = f32((p >> 16u) & 0xFFu) / 255.0;
    gray  = 0.299*r + 0.587*g + 0.114*b;
  }
  dst[gid.y * u.padW + gid.x] = (gray - mean) / std;
}
`;

// Compute mean and variance of the image for normalization (single-pass)
const SHADER_IMG_STATS = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }

@group(0) @binding(0) var<uniform>             u:    U;
@group(0) @binding(1) var<storage,read>        src:  array<u32>;   // RGBA8
@group(0) @binding(2) var<storage,read_write>  stat: array<f32>;   // [mean, std] — use as float accumulation

var<workgroup> wgSum:  array<f32, 256>;
var<workgroup> wgSum2: array<f32, 256>;

@compute @workgroup_size(256)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id)  lid: vec3<u32>,
) {
  var v = 0.0;
  if (gid.x < u.n) {
    let p = src[gid.x];
    let r = f32((p >>  0u) & 0xFFu) / 255.0;
    let g = f32((p >>  8u) & 0xFFu) / 255.0;
    let b = f32((p >> 16u) & 0xFFu) / 255.0;
    v = 0.299*r + 0.587*g + 0.114*b;
  }
  wgSum[lid.x]  = v;
  wgSum2[lid.x] = v * v;
  workgroupBarrier();

  for (var s = 128u; s > 0u; s >>= 1u) {
    if (lid.x < s) {
      wgSum[lid.x]  += wgSum[lid.x + s];
      wgSum2[lid.x] += wgSum2[lid.x + s];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    let mean = wgSum[0] / f32(u.n);
    let var_ = max(0.0, wgSum2[0] / f32(u.n) - mean*mean);
    // Use atomic-free approach: only one workgroup writes (approximate for demo)
    stat[0] = mean;
    stat[1] = sqrt(var_);
  }
}
`;

// Pack multiple normalized [H, W] images into batched [N, H, padW] tensor
// (just a memcpy-style concatenation along batch axis)
const SHADER_BATCH_PACK = /* wgsl */`
struct U {
  n:    u32,   // total elements in this item
  batchOffset: u32,
  _p0:  u32,
  _p1:  u32,
}
@group(0) @binding(0) var<uniform>            u:    U;
@group(0) @binding(1) var<storage,read>       src:  array<f32>;
@group(0) @binding(2) var<storage,read_write> dst:  array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  dst[u.batchOffset + gid.x] = src[gid.x];
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

const TARGET_H  = 32;
const MAX_W     = 320;  // max line width in pixels

export class LineNormalizeStage {
  constructor(targetH = TARGET_H, maxW = MAX_W) {
    this.targetH = targetH;
    this.maxW    = maxW;
    this._p      = null;
  }

  async _build() {
    if (this._p) return;
    const mk = (src, lbl) => gpuContext.createComputePipeline(
      gpuContext.createShaderModule(src, lbl), 'main');
    this._p = {
      resize:     mk(SHADER_RESIZE,       'norm:resize'),
      imgStats:   mk(SHADER_IMG_STATS,    'norm:stats'),
      toGrayNorm: mk(SHADER_TO_GRAY_NORM, 'norm:gray'),
      batchPack:  mk(SHADER_BATCH_PACK,   'norm:pack'),
    };
  }

  /**
   * Normalize a single crop to target height, convert to gray float.
   * @param {Tensor} cropTensor - [cropH * cropW] u32
   * @param {number} cropH, cropW
   * @returns {Promise<{normTensor: Tensor, normH: number, normW: number}>}
   */
  async normalizeOne(cropTensor, cropH, cropW) {
    gpuContext.assertReady();
    await this._build();

    // Compute output width from aspect ratio
    const scale = this.targetH / cropH;
    const rawW  = Math.round(cropW * scale);
    const normW = Math.min(rawW, this.maxW);
    const normH = this.targetH;

    // ── Resize ────────────────────────────────────────────────────────────
    const resized = new Tensor([normH * normW], 'u32', 0, 'norm:resized');
    {
      const u = createUniformBuffer({ srcW: cropW, srcH: cropH, dstW: normW, dstH: normH });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.resize.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), cropTensor.bindingEntry(1, true), resized.bindingEntry(2)],
      });
      gpuContext.dispatch(this._p.resize, bg, [Math.ceil(normW / 16), Math.ceil(normH / 16), 1]);
    }

    // ── Image stats ───────────────────────────────────────────────────────
    const statBuf = Tensor.zeros([2], 'f32', 'norm:stat');
    {
      const u = createUniformBuffer({ n: normH * normW, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.imgStats.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), resized.bindingEntry(1, true), statBuf.bindingEntry(2)],
      });
      // Single workgroup is enough for small images (up to 256 px)
      gpuContext.dispatch(this._p.imgStats, bg, [1, 1, 1]);
    }

    // ── Grayscale + normalize → float ─────────────────────────────────────
    const padW = this.maxW;  // always pad to maxW for batching
    const normTensor = new Tensor([normH * padW], 'f32', 0, 'norm:out');
    {
      const u = createUniformBuffer({ srcW: normW, srcH: normH, padW, _p: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.toGrayNorm.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), resized.bindingEntry(1, true),
                  statBuf.bindingEntry(2, true), normTensor.bindingEntry(3)],
      });
      gpuContext.dispatch(this._p.toGrayNorm, bg,
        [Math.ceil(padW / 16), Math.ceil(normH / 16), 1]);
    }

    resized.destroy();
    statBuf.destroy();

    return { normTensor, normH, normW, paddedW: padW };
  }

  /**
   * Normalize all line crops and pack into a batch tensor.
   * @param {LineRegion[]} lineRegions
   * @returns {Promise<NormResult>}
   */
  async run(lineRegions) {
    gpuContext.assertReady();
    await this._build();

    const normalizedItems = [];

    for (const region of lineRegions) {
      const { cropTensor, cropH, cropW } = region;
      const result = await this.normalizeOne(cropTensor, cropH, cropW);
      normalizedItems.push({ ...region, ...result });
    }

    await gpuContext.sync();

    // Pack into a batch tensor [N, H, padW]
    const N = normalizedItems.length;
    if (N === 0) {
      return { normalizedItems, batchTensor: null, batchN: 0 };
    }

    const H    = this.targetH;
    const padW = this.maxW;
    const batchTensor = Tensor.zeros([N * H * padW], 'f32', 'norm:batch');

    for (let i = 0; i < N; i++) {
      const { normTensor } = normalizedItems[i];
      const u = createUniformBuffer({
        n: H * padW,
        batchOffset: i * H * padW,
        _p0: 0, _p1: 0,
      });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.batchPack.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), normTensor.bindingEntry(1, true), batchTensor.bindingEntry(2)],
      });
      gpuContext.dispatch(this._p.batchPack, bg, [Math.ceil(H * padW / 256), 1, 1]);
    }

    await gpuContext.sync();

    // Cleanup individual tensors
    for (const item of normalizedItems) {
      item.normTensor.destroy();
    }

    return {
      normalizedItems,
      batchTensor,   // [N * H * padW] f32
      batchN: N,
      batchH: H,
      batchW: padW,
    };
  }
}

/**
 * @typedef {Object} NormResult
 * @property {object[]} normalizedItems
 * @property {Tensor|null} batchTensor - [N * H * W] f32 gray
 * @property {number} batchN
 * @property {number} batchH
 * @property {number} batchW
 */
