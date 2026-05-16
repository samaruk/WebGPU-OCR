/**
 * 05_dbnet.js — DBNet Text Detection
 *
 * Runs a slim DBNet-style text detection network entirely on WebGPU.
 * Architecture (simplified for WebGPU compute feasibility):
 *   Backbone: 4 feature extraction blocks (conv → BN → ReLU)
 *   Neck:     FPN-style feature fusion (upsampling + add)
 *   Head:     Two 1×1 convolution outputs
 *             - probability map (sigmoid)
 *             - threshold map (sigmoid)
 *   Post:     Binary map = (prob - threshold) > 0
 *
 * Weights are loaded from external .bin files (Float32Array, row-major).
 * The WGSL shaders implement the full forward pass.
 *
 * See models/dbnet.wgsl for shared shader library.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── Inline WGSL conv2d kernel (reused for all conv layers) ──────────────────

export const SHADER_CONV2D = /* wgsl */`
// Generalized conv2d: supports stride, padding, groups=1
// Input:   [C_in * H * W]  (NCHW, N=1)
// Weights: [C_out * C_in * kH * kW]
// Bias:    [C_out]
// Output:  [C_out * outH * outW]

struct ConvUniforms {
  inC:     u32,  inH:   u32, inW:   u32,
  outC:    u32,  outH:  u32, outW:  u32,
  kH:      u32,  kW:    u32,
  padH:    u32,  padW:  u32,
  strideH: u32,  strideW: u32,
  hasBias: u32,  activation: u32,  // 0=linear 1=relu 2=sigmoid
  _p:      u32,  _p2:  u32,
}

@group(0) @binding(0) var<uniform>            cu:  ConvUniforms;
@group(0) @binding(1) var<storage,read>       inp: array<f32>;
@group(0) @binding(2) var<storage,read>       wts: array<f32>;
@group(0) @binding(3) var<storage,read>       bis: array<f32>;
@group(0) @binding(4) var<storage,read_write> out: array<f32>;

fn relu(x: f32) -> f32 { return max(0.0, x); }
fn sigmoid(x: f32) -> f32 { return 1.0 / (1.0 + exp(-x)); }

@compute @workgroup_size(8, 8, 4)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let ow = gid.x;  // output width
  let oh = gid.y;  // output height
  let oc = gid.z;  // output channel

  if (ow >= cu.outW || oh >= cu.outH || oc >= cu.outC) { return; }

  var acc = 0.0;

  for (var ic = 0u; ic < cu.inC; ic++) {
    for (var kh = 0u; kh < cu.kH; kh++) {
      for (var kw = 0u; kw < cu.kW; kw++) {
        let ih = i32(oh * cu.strideH + kh) - i32(cu.padH);
        let iw = i32(ow * cu.strideW + kw) - i32(cu.padW);

        var inVal = 0.0;
        if (ih >= 0 && ih < i32(cu.inH) && iw >= 0 && iw < i32(cu.inW)) {
          inVal = inp[ic * cu.inH * cu.inW + u32(ih) * cu.inW + u32(iw)];
        }

        let wIdx = oc * (cu.inC * cu.kH * cu.kW)
                 + ic * (cu.kH * cu.kW)
                 + kh * cu.kW + kw;
        acc += inVal * wts[wIdx];
      }
    }
  }

  if (cu.hasBias != 0u) { acc += bis[oc]; }

  // Activation
  if      (cu.activation == 1u) { acc = relu(acc); }
  else if (cu.activation == 2u) { acc = sigmoid(acc); }

  out[oc * cu.outH * cu.outW + oh * cu.outW + ow] = acc;
}
`;

// Batch normalization (inference: fold into scale/bias)
export const SHADER_BN = /* wgsl */`
struct BNUniforms { C: u32, HW: u32, _p0: u32, _p1: u32, }

@group(0) @binding(0) var<uniform>             u:     BNUniforms;
@group(0) @binding(1) var<storage,read>        gamma: array<f32>;   // [C]
@group(0) @binding(2) var<storage,read>        beta:  array<f32>;   // [C]
@group(0) @binding(3) var<storage,read>        mean:  array<f32>;   // [C]
@group(0) @binding(4) var<storage,read>        var_:  array<f32>;   // [C]
@group(0) @binding(5) var<storage,read_write>  data:  array<f32>;   // [C*HW] in-place

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.C * u.HW) { return; }
  let c   = gid.x / u.HW;
  let eps = 1e-5;
  let x   = data[gid.x];
  let xn  = (x - mean[c]) / sqrt(var_[c] + eps);
  data[gid.x] = gamma[c] * xn + beta[c];
}
`;

// ReLU (in-place)
export const SHADER_RELU = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage,read_write> data: array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  data[gid.x] = max(0.0, data[gid.x]);
}
`;

// Bilinear upsample 2× for FPN neck
export const SHADER_UPSAMPLE2X = /* wgsl */`
struct U { inC: u32, inH: u32, inW: u32, _p: u32, }

@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       src: array<f32>;  // [C, H, W]
@group(0) @binding(2) var<storage,read_write> dst: array<f32>;  // [C, 2H, 2W]

@compute @workgroup_size(8, 8, 4)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let ow = gid.x;
  let oh = gid.y;
  let c  = gid.z;
  let outH = u.inH * 2u;
  let outW = u.inW * 2u;
  if (ow >= outW || oh >= outH || c >= u.inC) { return; }

  // Map output pixel to input space (nearest-neighbor for simplicity)
  let iw = ow / 2u;
  let ih = oh / 2u;
  dst[c * outH * outW + oh * outW + ow] =
    src[c * u.inH * u.inW + ih * u.inW + iw];
}
`;

// Element-wise add two feature maps (for FPN shortcut connections)
export const SHADER_ADD = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       a:   array<f32>;
@group(0) @binding(2) var<storage,read>       b:   array<f32>;
@group(0) @binding(3) var<storage,read_write> dst: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  dst[gid.x] = a[gid.x] + b[gid.x];
}
`;

// Differentiable binarization: binary = (prob - thresh) > 0 (soft version)
export const SHADER_DB_BINARY = /* wgsl */`
struct U { n: u32, k: f32, _p0: u32, _p1: u32, }

@group(0) @binding(0) var<uniform>            u:      U;
@group(0) @binding(1) var<storage,read>       prob:   array<f32>;
@group(0) @binding(2) var<storage,read>       thresh: array<f32>;
@group(0) @binding(3) var<storage,read_write> binary: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let p = prob[gid.x];
  let t = thresh[gid.x];
  // Differentiable binarization: sigmoid(k * (p - t))
  binary[gid.x] = 1.0 / (1.0 + exp(-u.k * (p - t)));
}
`;

// Normalize input image for DBNet: mean subtraction + scale
export const SHADER_NORMALIZE = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
// ImageNet mean/std normalization
// mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225]
@group(0) @binding(0) var<uniform>            u:    U;
@group(0) @binding(1) var<storage,read>       rgba: array<u32>;   // packed RGBA8
@group(0) @binding(2) var<storage,read_write> chw:  array<f32>;   // [3, H, W]

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let p = rgba[gid.x];
  let r = f32((p >>  0u) & 0xFFu) / 255.0;
  let g = f32((p >>  8u) & 0xFFu) / 255.0;
  let b = f32((p >> 16u) & 0xFFu) / 255.0;
  chw[0u * u.n + gid.x] = (r - 0.485) / 0.229;
  chw[1u * u.n + gid.x] = (g - 0.456) / 0.224;
  chw[2u * u.n + gid.x] = (b - 0.406) / 0.225;
}
`;

// ─── Weight store ─────────────────────────────────────────────────────────────

/**
 * Loads model weights from a flat binary ArrayBuffer.
 * Layout: [header: N layers × {nameLen, offset, size}] [data...]
 * In practice, weights are pre-fetched and passed in.
 */
export class DBNetWeights {
  constructor(weightsBuffer) {
    this._raw = weightsBuffer;
    this._layers = {};
    this._parse();
  }

  _parse() {
    const view = new DataView(this._raw);
    const numLayers = view.getUint32(0, true);
    let off = 4;
    for (let i = 0; i < numLayers; i++) {
      const nameLen = view.getUint32(off, true); off += 4;
      const nameBytes = new Uint8Array(this._raw, off, nameLen); off += nameLen;
      const name = new TextDecoder().decode(nameBytes);
      const dataOff = view.getUint32(off, true); off += 4;
      const dataLen = view.getUint32(off, true); off += 4;
      this._layers[name] = new Float32Array(this._raw, dataOff, dataLen / 4);
    }
  }

  /** Get a layer's weights as Float32Array */
  get(name) {
    if (!this._layers[name]) {
      console.warn(`[DBNetWeights] Layer "${name}" not found. Returning zeros.`);
      return new Float32Array(0);
    }
    return this._layers[name];
  }
}

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class DBNetStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    const mk = (src, ep = 'main') => gpuContext.createComputePipeline(
      gpuContext.createShaderModule(src, ep), ep);
    this._p = {
      normalize: mk(SHADER_NORMALIZE, 'main'),
      conv2d:    mk(SHADER_CONV2D,    'main'),
      bn:        mk(SHADER_BN,        'main'),
      relu:      mk(SHADER_RELU,      'main'),
      upsample:  mk(SHADER_UPSAMPLE2X,'main'),
      add:       mk(SHADER_ADD,       'main'),
      dbBinary:  mk(SHADER_DB_BINARY, 'main'),
    };
  }

  /**
   * Run a conv → BN → ReLU block.
   * @private
   */
  _convBnRelu(inp, inC, inH, inW, outC, kH, kW, pad, stride, weights, name) {
    const p = this._p;
    const outH = Math.floor((inH + 2 * pad - kH) / stride + 1);
    const outW = Math.floor((inW + 2 * pad - kW) / stride + 1);
    const out = new Tensor([outC, outH, outW], 'f32', 0, `dbnet:${name}`);

    const convW = Tensor.fromData(weights.get(`${name}.weight`), [outC * inC * kH * kW], 'f32');
    const convB = Tensor.fromData(weights.get(`${name}.bias`) || new Float32Array(outC).fill(0),
                                   [outC], 'f32');
    const cu = createUniformBuffer({
      inC, inH, inW, outC, outH, outW, kH, kW,
      padH: pad, padW: pad, strideH: stride, strideW: stride,
      hasBias: 0, activation: 1,  // ReLU activation
      _p: 0, _p2: 0,
    });
    const bg = gpuContext.device.createBindGroup({
      layout: p.conv2d.getBindGroupLayout(0),
      entries: [cu.bindingEntry(0), inp.bindingEntry(1, true),
                convW.bindingEntry(2, true), convB.bindingEntry(3, true), out.bindingEntry(4)],
    });
    gpuContext.dispatch(p.conv2d, bg,
      [Math.ceil(outW / 8), Math.ceil(outH / 8), Math.ceil(outC / 4)]);

    // BN
    const bnGamma = Tensor.fromData(weights.get(`${name}.bn.weight`) || new Float32Array(outC).fill(1), [outC]);
    const bnBeta  = Tensor.fromData(weights.get(`${name}.bn.bias`)   || new Float32Array(outC).fill(0), [outC]);
    const bnMean  = Tensor.fromData(weights.get(`${name}.bn.running_mean`) || new Float32Array(outC).fill(0), [outC]);
    const bnVar   = Tensor.fromData(weights.get(`${name}.bn.running_var`)  || new Float32Array(outC).fill(1), [outC]);
    const uBN = createUniformBuffer({ C: outC, HW: outH * outW, _p0: 0, _p1: 0 });
    const bgBN = gpuContext.device.createBindGroup({
      layout: p.bn.getBindGroupLayout(0),
      entries: [uBN.bindingEntry(0), bnGamma.bindingEntry(1, true), bnBeta.bindingEntry(2, true),
                bnMean.bindingEntry(3, true), bnVar.bindingEntry(4, true), out.bindingEntry(5)],
    });
    gpuContext.dispatch(p.bn, bgBN, [Math.ceil(outC * outH * outW / 256), 1, 1]);

    [convW, convB, bnGamma, bnBeta, bnMean, bnVar].forEach(t => t.destroy());
    return { tensor: out, H: outH, W: outW };
  }

  /**
   * Main DBNet forward pass.
   * @param {Tensor} imageTensor - [H*W] u32 packed RGBA8
   * @param {number} H, W
   * @param {DBNetWeights} weights
   * @returns {Promise<DBNetResult>}
   */
  async run(imageTensor, H, W, weights) {
    gpuContext.assertReady();
    await this._build();
    const p = this._p;
    const N = H * W;

    // ── Normalize input → CHW float ────────────────────────────────────────
    const chw = new Tensor([3, H, W], 'f32', 0, 'dbnet:input');
    {
      const u = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.normalize.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), imageTensor.bindingEntry(1, true), chw.bindingEntry(2)],
      });
      gpuContext.dispatch(p.normalize, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── Backbone: 4 conv blocks with downsampling ─────────────────────────
    // Block 1: 3→64 ch, stride 2 → H/2, W/2
    const b1 = this._convBnRelu(chw, 3, H, W, 64, 3, 3, 1, 2, weights, 'backbone.b1');
    // Block 2: 64→128, stride 2 → H/4, W/4
    const b2 = this._convBnRelu(b1.tensor, 64, b1.H, b1.W, 128, 3, 3, 1, 2, weights, 'backbone.b2');
    // Block 3: 128→256, stride 2 → H/8, W/8
    const b3 = this._convBnRelu(b2.tensor, 128, b2.H, b2.W, 256, 3, 3, 1, 2, weights, 'backbone.b3');
    // Block 4: 256→256, stride 1 → H/8, W/8 (deeper features)
    const b4 = this._convBnRelu(b3.tensor, 256, b3.H, b3.W, 256, 3, 3, 1, 1, weights, 'backbone.b4');

    // ── FPN Neck ──────────────────────────────────────────────────────────
    // Reduce all to 64 channels via 1×1 conv
    const n4 = this._convBnRelu(b4.tensor, 256, b4.H, b4.W, 64, 1, 1, 0, 1, weights, 'neck.p4');
    const n3 = this._convBnRelu(b3.tensor, 256, b3.H, b3.W, 64, 1, 1, 0, 1, weights, 'neck.p3');
    const n2 = this._convBnRelu(b2.tensor, 128, b2.H, b2.W, 64, 1, 1, 0, 1, weights, 'neck.p2');

    // Upsample p4 to p3 size, add
    const up4 = new Tensor([64, n3.H, n3.W], 'f32', 0, 'dbnet:up4');
    {
      const u = createUniformBuffer({ inC: 64, inH: n4.H, inW: n4.W, _p: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.upsample.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), n4.tensor.bindingEntry(1, true), up4.bindingEntry(2)],
      });
      gpuContext.dispatch(p.upsample, bg,
        [Math.ceil(n3.W / 8), Math.ceil(n3.H / 8), Math.ceil(64 / 4)]);
    }

    const fused3 = new Tensor([64, n3.H, n3.W], 'f32', 0, 'dbnet:fused3');
    {
      const u = createUniformBuffer({ n: 64 * n3.H * n3.W, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.add.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), up4.bindingEntry(1, true), n3.tensor.bindingEntry(2, true), fused3.bindingEntry(3)],
      });
      gpuContext.dispatch(p.add, bg, [Math.ceil(64 * n3.H * n3.W / 256), 1, 1]);
    }

    // Upsample fused3 to p2 size, add
    const up3 = new Tensor([64, n2.H, n2.W], 'f32', 0, 'dbnet:up3');
    {
      const u = createUniformBuffer({ inC: 64, inH: n3.H, inW: n3.W, _p: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.upsample.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), fused3.bindingEntry(1, true), up3.bindingEntry(2)],
      });
      gpuContext.dispatch(p.upsample, bg,
        [Math.ceil(n2.W / 8), Math.ceil(n2.H / 8), Math.ceil(64 / 4)]);
    }

    const fused2 = new Tensor([64, n2.H, n2.W], 'f32', 0, 'dbnet:fused2');
    {
      const u = createUniformBuffer({ n: 64 * n2.H * n2.W, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.add.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), up3.bindingEntry(1, true), n2.tensor.bindingEntry(2, true), fused2.bindingEntry(3)],
      });
      gpuContext.dispatch(p.add, bg, [Math.ceil(64 * n2.H * n2.W / 256), 1, 1]);
    }

    // ── Head: probability map ─────────────────────────────────────────────
    // 1×1 conv to 1 channel + sigmoid
    const probTensor = new Tensor([1, n2.H, n2.W], 'f32', 0, 'dbnet:prob');
    {
      const headW = Tensor.fromData(
        weights.get('head.prob.weight') || new Float32Array(64).fill(0.01), [64]);
      const headB = Tensor.fromData(
        weights.get('head.prob.bias')   || new Float32Array(1).fill(0), [1]);
      const cu = createUniformBuffer({
        inC: 64, inH: n2.H, inW: n2.W, outC: 1,
        outH: n2.H, outW: n2.W, kH: 1, kW: 1,
        padH: 0, padW: 0, strideH: 1, strideW: 1,
        hasBias: 1, activation: 2, _p: 0, _p2: 0,
      });
      const bg = gpuContext.device.createBindGroup({
        layout: p.conv2d.getBindGroupLayout(0),
        entries: [cu.bindingEntry(0), fused2.bindingEntry(1, true),
                  headW.bindingEntry(2, true), headB.bindingEntry(3, true), probTensor.bindingEntry(4)],
      });
      gpuContext.dispatch(p.conv2d, bg,
        [Math.ceil(n2.W / 8), Math.ceil(n2.H / 8), 1]);
      headW.destroy(); headB.destroy();
    }

    // ── Head: threshold map ───────────────────────────────────────────────
    const threshTensor = new Tensor([1, n2.H, n2.W], 'f32', 0, 'dbnet:thresh');
    {
      const thW = Tensor.fromData(
        weights.get('head.thresh.weight') || new Float32Array(64).fill(0.01), [64]);
      const thB = Tensor.fromData(
        weights.get('head.thresh.bias')   || new Float32Array(1).fill(-2), [1]);
      const cu = createUniformBuffer({
        inC: 64, inH: n2.H, inW: n2.W, outC: 1,
        outH: n2.H, outW: n2.W, kH: 1, kW: 1,
        padH: 0, padW: 0, strideH: 1, strideW: 1,
        hasBias: 1, activation: 2, _p: 0, _p2: 0,
      });
      const bg = gpuContext.device.createBindGroup({
        layout: p.conv2d.getBindGroupLayout(0),
        entries: [cu.bindingEntry(0), fused2.bindingEntry(1, true),
                  thW.bindingEntry(2, true), thB.bindingEntry(3, true), threshTensor.bindingEntry(4)],
      });
      gpuContext.dispatch(p.conv2d, bg,
        [Math.ceil(n2.W / 8), Math.ceil(n2.H / 8), 1]);
      thW.destroy(); thB.destroy();
    }

    // ── Differentiable binarization ───────────────────────────────────────
    const binaryMapSize = n2.H * n2.W;
    const binaryTensor = new Tensor([1, n2.H, n2.W], 'f32', 0, 'dbnet:binary');
    {
      const u = createUniformBuffer({ n: binaryMapSize, k: 50.0, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.dbBinary.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), probTensor.bindingEntry(1, true),
                  threshTensor.bindingEntry(2, true), binaryTensor.bindingEntry(3)],
      });
      gpuContext.dispatch(p.dbBinary, bg, [Math.ceil(binaryMapSize / 256), 1, 1]);
    }

    await gpuContext.sync();

    // Cleanup backbone/neck
    [chw, b1.tensor, b2.tensor, b3.tensor, b4.tensor,
     n4.tensor, n3.tensor, n2.tensor,
     up4, fused3, up3, fused2].forEach(t => t.destroy());

    return {
      probTensor,       // [1, H/4, W/4]
      threshTensor,     // [1, H/4, W/4]
      binaryTensor,     // [1, H/4, W/4]
      mapH: n2.H,
      mapW: n2.W,
      scaleH: H / n2.H,
      scaleW: W / n2.W,
    };
  }
}

/**
 * @typedef {Object} DBNetResult
 * @property {Tensor} probTensor
 * @property {Tensor} threshTensor
 * @property {Tensor} binaryTensor
 * @property {number} mapH
 * @property {number} mapW
 * @property {number} scaleH
 * @property {number} scaleW
 */
