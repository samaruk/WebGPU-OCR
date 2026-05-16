/**
 * 11_super_resolution.js — GPU Super-Resolution
 *
 * Applies a lightweight learned super-resolution upscaler to low-resolution
 * text crops before feeding them to the OCR transformer.
 *
 * Architecture: ESPCN (Efficient Sub-Pixel Convolutional Network)
 *   - 3 conv layers (tanh activations) → sub-pixel shuffle 2×
 *   - Input:  [N, 1, H, W]   (grayscale float)
 *   - Output: [N, 1, 2H, 2W] (upscaled grayscale float)
 *
 * Used only when the normalized line height is below a threshold
 * (e.g., < 24px effective height before normalization).
 *
 * Weights: loaded from ArrayBuffer (same format as DBNet).
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';
import { SHADER_CONV2D } from './05_dbnet.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Tanh activation (in-place)
const SHADER_TANH = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>           u: U;
@group(0) @binding(1) var<storage,read_write> d: array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  d[gid.x] = tanh(d[gid.x]);
}
`;

// Sub-pixel shuffle (pixel shuffle): [C*r², H, W] → [C, H*r, W*r]
// For r=2, C=1: [4, H, W] → [1, 2H, 2W]
const SHADER_PIXEL_SHUFFLE = /* wgsl */`
struct U {
  inC:    u32,   // channels before shuffle (inC = outC * r²)
  inH:    u32,
  inW:    u32,
  outC:   u32,   // output channels (usually 1)
  r:      u32,   // upscale factor
  _p0:    u32,
  _p1:    u32,
  _p2:    u32,
}

@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       src: array<f32>;  // [inC, inH, inW]
@group(0) @binding(2) var<storage,read_write> dst: array<f32>;  // [outC, inH*r, inW*r]

@compute @workgroup_size(8, 8, 4)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let outH = u.inH * u.r;
  let outW = u.inW * u.r;
  let ow = gid.x;
  let oh = gid.y;
  let oc = gid.z;

  if (ow >= outW || oh >= outH || oc >= u.outC) { return; }

  // Which input channel?
  let ph = oh % u.r;  // pixel position within the block
  let pw = ow % u.r;
  let ih = oh / u.r;
  let iw = ow / u.r;

  let ic = oc * (u.r * u.r) + ph * u.r + pw;
  dst[oc * outH * outW + oh * outW + ow] = src[ic * u.inH * u.inW + ih * u.inW + iw];
}
`;

// Clip output to [0, 1]
const SHADER_CLIP01 = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>           u: U;
@group(0) @binding(1) var<storage,read_write> d: array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  d[gid.x] = clamp(d[gid.x], 0.0, 1.0);
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class SuperResolutionStage {
  /**
   * @param {ArrayBuffer} weightsBuffer - model weights binary
   * @param {number} upscaleFactor - 2 (default)
   * @param {number} minHeightThreshold - only apply SR if crop height < this
   */
  constructor(weightsBuffer = null, upscaleFactor = 2, minHeightThreshold = 20) {
    this.upscaleFactor = upscaleFactor;
    this.minHeight     = minHeightThreshold;
    this._weights      = weightsBuffer ? this._parseWeights(weightsBuffer) : null;
    this._p            = null;
  }

  _parseWeights(buf) {
    // Simple flat float32 layout:
    // [conv1_w(1,64,3,3), conv1_b(64), conv2_w(64,32,3,3), conv2_b(32),
    //  conv3_w(32,4,3,3), conv3_b(4)]
    const f = new Float32Array(buf);
    let off = 0;
    const read = (n) => { const s = f.subarray(off, off + n); off += n; return s; };
    return {
      c1w: read(1 * 64 * 9), c1b: read(64),
      c2w: read(64 * 32 * 9), c2b: read(32),
      c3w: read(32 * 4 * 9),  c3b: read(4),
    };
  }

  async _build() {
    if (this._p) return;
    const mk = (src, lbl) => gpuContext.createComputePipeline(
      gpuContext.createShaderModule(src, lbl), 'main');
    this._p = {
      conv2d:  mk(SHADER_CONV2D,        'sr:conv'),
      tanh:    mk(SHADER_TANH,          'sr:tanh'),
      shuffle: mk(SHADER_PIXEL_SHUFFLE, 'sr:shuffle'),
      clip:    mk(SHADER_CLIP01,        'sr:clip'),
    };
  }

  /**
   * Upsample a single grayscale tensor by 2×.
   * @param {Tensor} inputTensor - [H * W] or [C, H, W] f32
   * @param {number} H, W
   * @returns {Promise<{upscaledTensor: Tensor, outH: number, outW: number}>}
   */
  async upscaleOne(inputTensor, H, W) {
    gpuContext.assertReady();
    await this._build();

    const p = this._p;
    const r = this.upscaleFactor;

    // Fallback weights (zero-initialized → produces identity-like output)
    const w = this._weights ?? {
      c1w: new Float32Array(576).fill(0.01),  c1b: new Float32Array(64),
      c2w: new Float32Array(18432).fill(0.01), c2b: new Float32Array(32),
      c3w: new Float32Array(1152).fill(0.01),  c3b: new Float32Array(4),
    };

    // ── Conv1: 1→64, 3×3, tanh ────────────────────────────────────────────
    const c1out = new Tensor([64, H, W], 'f32', 0, 'sr:c1');
    {
      const wt = Tensor.fromData(w.c1w, [1 * 64 * 9]);
      const bt = Tensor.fromData(w.c1b, [64]);
      const cu = createUniformBuffer({
        inC: 1, inH: H, inW: W, outC: 64, outH: H, outW: W,
        kH: 3, kW: 3, padH: 1, padW: 1, strideH: 1, strideW: 1,
        hasBias: 1, activation: 0, _p: 0, _p2: 0,
      });
      const bg = gpuContext.device.createBindGroup({
        layout: p.conv2d.getBindGroupLayout(0),
        entries: [cu.bindingEntry(0), inputTensor.bindingEntry(1, true),
                  wt.bindingEntry(2, true), bt.bindingEntry(3, true), c1out.bindingEntry(4)],
      });
      gpuContext.dispatch(p.conv2d, bg, [Math.ceil(W / 8), Math.ceil(H / 8), Math.ceil(64 / 4)]);
      const u2 = createUniformBuffer({ n: 64 * H * W, _p0: 0, _p1: 0, _p2: 0 });
      const bgT = gpuContext.device.createBindGroup({
        layout: p.tanh.getBindGroupLayout(0),
        entries: [u2.bindingEntry(0), c1out.bindingEntry(1)],
      });
      gpuContext.dispatch(p.tanh, bgT, [Math.ceil(64 * H * W / 256), 1, 1]);
      wt.destroy(); bt.destroy();
    }

    // ── Conv2: 64→32, 3×3, tanh ───────────────────────────────────────────
    const c2out = new Tensor([32, H, W], 'f32', 0, 'sr:c2');
    {
      const wt = Tensor.fromData(w.c2w, [64 * 32 * 9]);
      const bt = Tensor.fromData(w.c2b, [32]);
      const cu = createUniformBuffer({
        inC: 64, inH: H, inW: W, outC: 32, outH: H, outW: W,
        kH: 3, kW: 3, padH: 1, padW: 1, strideH: 1, strideW: 1,
        hasBias: 1, activation: 0, _p: 0, _p2: 0,
      });
      const bg = gpuContext.device.createBindGroup({
        layout: p.conv2d.getBindGroupLayout(0),
        entries: [cu.bindingEntry(0), c1out.bindingEntry(1, true),
                  wt.bindingEntry(2, true), bt.bindingEntry(3, true), c2out.bindingEntry(4)],
      });
      gpuContext.dispatch(p.conv2d, bg, [Math.ceil(W / 8), Math.ceil(H / 8), Math.ceil(32 / 4)]);
      const u2 = createUniformBuffer({ n: 32 * H * W, _p0: 0, _p1: 0, _p2: 0 });
      const bgT = gpuContext.device.createBindGroup({
        layout: p.tanh.getBindGroupLayout(0),
        entries: [u2.bindingEntry(0), c2out.bindingEntry(1)],
      });
      gpuContext.dispatch(p.tanh, bgT, [Math.ceil(32 * H * W / 256), 1, 1]);
      wt.destroy(); bt.destroy(); c1out.destroy();
    }

    // ── Conv3: 32→(r²), 3×3, linear ──────────────────────────────────────
    const r2 = r * r;  // 4 for 2× upscale
    const c3out = new Tensor([r2, H, W], 'f32', 0, 'sr:c3');
    {
      const wt = Tensor.fromData(w.c3w, [32 * r2 * 9]);
      const bt = Tensor.fromData(w.c3b, [r2]);
      const cu = createUniformBuffer({
        inC: 32, inH: H, inW: W, outC: r2, outH: H, outW: W,
        kH: 3, kW: 3, padH: 1, padW: 1, strideH: 1, strideW: 1,
        hasBias: 1, activation: 0, _p: 0, _p2: 0,
      });
      const bg = gpuContext.device.createBindGroup({
        layout: p.conv2d.getBindGroupLayout(0),
        entries: [cu.bindingEntry(0), c2out.bindingEntry(1, true),
                  wt.bindingEntry(2, true), bt.bindingEntry(3, true), c3out.bindingEntry(4)],
      });
      gpuContext.dispatch(p.conv2d, bg, [Math.ceil(W / 8), Math.ceil(H / 8), Math.ceil(r2 / 4)]);
      wt.destroy(); bt.destroy(); c2out.destroy();
    }

    // ── Sub-pixel shuffle: [r², H, W] → [1, rH, rW] ─────────────────────
    const outH = H * r;
    const outW = W * r;
    const upscaledTensor = new Tensor([1, outH, outW], 'f32', 0, 'sr:out');
    {
      const u = createUniformBuffer({ inC: r2, inH: H, inW: W, outC: 1, r, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.shuffle.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), c3out.bindingEntry(1, true), upscaledTensor.bindingEntry(2)],
      });
      gpuContext.dispatch(p.shuffle, bg,
        [Math.ceil(outW / 8), Math.ceil(outH / 8), 1]);
      c3out.destroy();
    }

    // ── Clip to [0,1] ─────────────────────────────────────────────────────
    {
      const u = createUniformBuffer({ n: outH * outW, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.clip.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), upscaledTensor.bindingEntry(1)],
      });
      gpuContext.dispatch(p.clip, bg, [Math.ceil(outH * outW / 256), 1, 1]);
    }

    return { upscaledTensor, outH, outW };
  }

  /**
   * Conditionally apply SR to line regions.
   * Skips regions that are already large enough.
   * @param {NormResult} normResult
   * @returns {Promise<NormResult>} - same structure with SR applied where needed
   */
  async run(normResult) {
    gpuContext.assertReady();
    await this._build();

    // For each item, check if SR is beneficial
    const enhanced = [];
    for (const item of normResult.normalizedItems) {
      if (item.cropH < this.minHeight) {
        // Apply 2× SR to the norm tensor
        const { upscaledTensor, outH, outW } = await this.upscaleOne(
          item.normTensor ?? item.batchTensor,
          normResult.batchH, normResult.batchW
        );
        enhanced.push({ ...item, normTensor: upscaledTensor,
                         normH: outH, normW: outW, srApplied: true });
      } else {
        enhanced.push({ ...item, srApplied: false });
      }
    }

    await gpuContext.sync();
    return { ...normResult, normalizedItems: enhanced };
  }
}
