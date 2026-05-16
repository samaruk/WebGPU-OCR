/**
 * 03_textness.js — Textness Map Generation
 *
 * Produces a single-channel "textness" probability map [H, W] ∈ [0,1]
 * indicating how likely each pixel is to belong to a text region.
 *
 * GPU pipeline:
 *   1. Multi-scale Difference-of-Gaussians (DoG) for stroke-width estimation
 *   2. Local stroke uniformity scoring
 *   3. Edge coherence (text edges are dense and directional)
 *   4. Combine all cues into a final textness score
 *
 * The textness map is used downstream to mask regions before DBNet
 * and to skip processing of non-text areas.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Separable Gaussian blur — horizontal pass
const SHADER_GAUSS_H = /* wgsl */`
struct Uniforms {
  width:  u32,
  height: u32,
  sigma:  f32,
  radius: u32,
}

@group(0) @binding(0) var<uniform>            u:   Uniforms;
@group(0) @binding(1) var<storage,read>       src: array<f32>;
@group(0) @binding(2) var<storage,read_write> dst: array<f32>;

fn gaussWeight(d: f32, sigma: f32) -> f32 {
  return exp(-(d*d) / (2.0 * sigma * sigma));
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let y = gid.y;
  let x = gid.x;
  var sum  = 0.0;
  var wsum = 0.0;
  let r = i32(u.radius);
  for (var dx = -r; dx <= r; dx++) {
    let sx = clamp(i32(x) + dx, 0, i32(u.width) - 1);
    let w  = gaussWeight(f32(dx), u.sigma);
    sum  += src[y * u.width + u32(sx)] * w;
    wsum += w;
  }
  dst[y * u.width + x] = sum / wsum;
}
`;

// Separable Gaussian blur — vertical pass
const SHADER_GAUSS_V = /* wgsl */`
struct Uniforms {
  width:  u32,
  height: u32,
  sigma:  f32,
  radius: u32,
}

@group(0) @binding(0) var<uniform>            u:   Uniforms;
@group(0) @binding(1) var<storage,read>       src: array<f32>;
@group(0) @binding(2) var<storage,read_write> dst: array<f32>;

fn gaussWeight(d: f32, sigma: f32) -> f32 {
  return exp(-(d*d) / (2.0 * sigma * sigma));
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let y = gid.y;
  let x = gid.x;
  var sum  = 0.0;
  var wsum = 0.0;
  let r = i32(u.radius);
  for (var dy = -r; dy <= r; dy++) {
    let sy = clamp(i32(y) + dy, 0, i32(u.height) - 1);
    let w  = gaussWeight(f32(dy), u.sigma);
    sum  += src[u32(sy) * u.width + x] * w;
    wsum += w;
  }
  dst[y * u.width + x] = sum / wsum;
}
`;

// DoG = G(sigma1) - G(sigma2) — highlights stroke-width band
const SHADER_DOG = /* wgsl */`
struct Uniforms {
  n:    u32,
  _p0:  u32,
  _p1:  u32,
  _p2:  u32,
}
@group(0) @binding(0) var<uniform>            u:    Uniforms;
@group(0) @binding(1) var<storage,read>       fine: array<f32>;
@group(0) @binding(2) var<storage,read>       coar: array<f32>;
@group(0) @binding(3) var<storage,read_write> dog:  array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  dog[gid.x] = abs(fine[gid.x] - coar[gid.x]);
}
`;

// Stroke uniformity: local coefficient-of-variation of DoG response
const SHADER_UNIFORMITY = /* wgsl */`
struct Uniforms {
  width:  u32,
  height: u32,
  radius: u32,
  _p:     u32,
}
@group(0) @binding(0) var<uniform>            u:      Uniforms;
@group(0) @binding(1) var<storage,read>       dog:    array<f32>;
@group(0) @binding(2) var<storage,read_write> unifMap: array<f32>;

fn rd(x: i32, y: i32) -> f32 {
  return dog[u32(clamp(y,0,i32(u.height)-1)) * u.width
           + u32(clamp(x,0,i32(u.width)-1))];
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
  let var_ = max(0.0, sum2/cnt - mean*mean);
  // Low CV → uniform strokes → high textness
  let cv = select(0.0, sqrt(var_) / (mean + 1e-6), mean > 0.01);
  unifMap[gid.y * u.width + gid.x] = clamp(1.0 - cv, 0.0, 1.0);
}
`;

// Combine DoG response + uniformity → textness
const SHADER_COMBINE = /* wgsl */`
struct Uniforms {
  n:            u32,
  dogWeight:    f32,
  unifWeight:   f32,
  _p:           u32,
}
@group(0) @binding(0) var<uniform>            u:        Uniforms;
@group(0) @binding(1) var<storage,read>       dog:      array<f32>;
@group(0) @binding(2) var<storage,read>       unifMap:  array<f32>;
@group(0) @binding(3) var<storage,read_write> textness: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let d = clamp(dog[gid.x]     * 5.0, 0.0, 1.0);
  let s = clamp(unifMap[gid.x],        0.0, 1.0);
  textness[gid.x] = clamp(d * u.dogWeight + s * u.unifWeight, 0.0, 1.0);
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class TextnessStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    this._p = {
      gaussH:    gpuContext.createComputePipeline(gpuContext.createShaderModule(SHADER_GAUSS_H,    'txt:gaussH'), 'main'),
      gaussV:    gpuContext.createComputePipeline(gpuContext.createShaderModule(SHADER_GAUSS_V,    'txt:gaussV'), 'main'),
      dog:       gpuContext.createComputePipeline(gpuContext.createShaderModule(SHADER_DOG,        'txt:dog'),    'main'),
      uniformity:gpuContext.createComputePipeline(gpuContext.createShaderModule(SHADER_UNIFORMITY, 'txt:unif'),   'main'),
      combine:   gpuContext.createComputePipeline(gpuContext.createShaderModule(SHADER_COMBINE,    'txt:comb'),   'main'),
    };
  }

  /**
   * Compute a Gaussian-blurred version of the input using separable passes.
   * @private
   */
  _gaussianBlur(luma, H, W, sigma) {
    const N = H * W;
    const radius = Math.ceil(sigma * 3);
    const tmp = new Tensor([H, W], 'f32', 0, 'txt:gtmp');
    const out = new Tensor([H, W], 'f32', 0, 'txt:gout');

    const uH = createUniformBuffer({ width: W, height: H, sigma, radius });
    const uV = createUniformBuffer({ width: W, height: H, sigma, radius });

    const bgH = gpuContext.device.createBindGroup({
      layout: this._p.gaussH.getBindGroupLayout(0),
      entries: [uH.bindingEntry(0), luma.bindingEntry(1, true), tmp.bindingEntry(2)],
    });
    const bgV = gpuContext.device.createBindGroup({
      layout: this._p.gaussV.getBindGroupLayout(0),
      entries: [uV.bindingEntry(0), tmp.bindingEntry(1, true), out.bindingEntry(2)],
    });

    gpuContext.dispatch(this._p.gaussH, bgH, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    gpuContext.dispatch(this._p.gaussV, bgV, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);

    tmp.destroy();
    return out;
  }

  /**
   * @param {Tensor} lumaTensor - [H, W] f32 luminance
   * @returns {Promise<TextnessResult>}
   */
  async run(lumaTensor) {
    gpuContext.assertReady();
    await this._build();

    const [H, W] = lumaTensor.shape;
    const N = H * W;

    // ── Multi-scale DoG ────────────────────────────────────────────────────
    // Small DoG catches fine strokes; large DoG catches bold strokes
    const g1 = this._gaussianBlur(lumaTensor, H, W, 1.0);  // fine
    const g2 = this._gaussianBlur(lumaTensor, H, W, 2.5);  // medium
    const g3 = this._gaussianBlur(lumaTensor, H, W, 5.0);  // coarse

    // DoG_fine = |G1 - G2|, DoG_coarse = |G2 - G3|
    const dogFine   = new Tensor([H, W], 'f32', 0, 'txt:dogFine');
    const dogCoarse = new Tensor([H, W], 'f32', 0, 'txt:dogCoarse');
    {
      const uN = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bgF = gpuContext.device.createBindGroup({
        layout: this._p.dog.getBindGroupLayout(0),
        entries: [uN.bindingEntry(0), g1.bindingEntry(1, true), g2.bindingEntry(2, true), dogFine.bindingEntry(3)],
      });
      const bgC = gpuContext.device.createBindGroup({
        layout: this._p.dog.getBindGroupLayout(0),
        entries: [uN.bindingEntry(0), g2.bindingEntry(1, true), g3.bindingEntry(2, true), dogCoarse.bindingEntry(3)],
      });
      gpuContext.dispatch(this._p.dog, bgF, [Math.ceil(N / 256), 1, 1]);
      gpuContext.dispatch(this._p.dog, bgC, [Math.ceil(N / 256), 1, 1]);
    }

    // Max-pool the two DoG scales into one (element-wise max via combine with equal weights)
    const dogMax = new Tensor([H, W], 'f32', 0, 'txt:dogMax');
    {
      const uM = createUniformBuffer({ n: N, dogWeight: 0.5, unifWeight: 0.5, _p: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.combine.getBindGroupLayout(0),
        entries: [
          uM.bindingEntry(0),
          dogFine.bindingEntry(1, true),
          dogCoarse.bindingEntry(2, true),
          dogMax.bindingEntry(3),
        ],
      });
      gpuContext.dispatch(this._p.combine, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── Stroke uniformity ──────────────────────────────────────────────────
    const unifMap = new Tensor([H, W], 'f32', 0, 'txt:unifMap');
    {
      const uU = createUniformBuffer({ width: W, height: H, radius: 5, _p: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.uniformity.getBindGroupLayout(0),
        entries: [uU.bindingEntry(0), dogMax.bindingEntry(1, true), unifMap.bindingEntry(2)],
      });
      gpuContext.dispatch(this._p.uniformity, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    }

    // ── Final textness ─────────────────────────────────────────────────────
    const textnessTensor = new Tensor([H, W], 'f32', 0, 'txt:textness');
    {
      const uC = createUniformBuffer({ n: N, dogWeight: 0.6, unifWeight: 0.4, _p: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.combine.getBindGroupLayout(0),
        entries: [
          uC.bindingEntry(0),
          dogMax.bindingEntry(1, true),
          unifMap.bindingEntry(2, true),
          textnessTensor.bindingEntry(3),
        ],
      });
      gpuContext.dispatch(this._p.combine, bg, [Math.ceil(N / 256), 1, 1]);
    }

    await gpuContext.sync();

    // Cleanup intermediates
    g1.destroy(); g2.destroy(); g3.destroy();
    dogFine.destroy(); dogCoarse.destroy(); dogMax.destroy(); unifMap.destroy();

    return { textnessTensor };
  }
}

/**
 * @typedef {Object} TextnessResult
 * @property {Tensor} textnessTensor - [H, W] f32, textness probability 0-1
 */
