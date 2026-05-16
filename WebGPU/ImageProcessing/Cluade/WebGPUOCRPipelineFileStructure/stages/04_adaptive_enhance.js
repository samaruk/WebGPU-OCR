/**
 * 04_adaptive_enhance.js — Adaptive Image Enhancement
 *
 * Applies IQA-informed adaptive enhancement to the input image:
 *   1. CLAHE (Contrast Limited Adaptive Histogram Equalization) on luma
 *   2. Bilateral-inspired edge-preserving denoise
 *   3. Unsharp masking (conditionally applied based on IQA blur score)
 *   4. Gamma correction (based on IQA exposure score)
 *   5. Reconstruct enhanced RGBA from processed luma + original chroma
 *
 * All passes run fully on the GPU.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Split RGBA → luma (Y) and chroma (Cb, Cr) as separate f32 arrays
const SHADER_RGB_TO_YCC = /* wgsl */`
struct Uniforms { n: u32, _p0: u32, _p1: u32, _p2: u32, }

@group(0) @binding(0) var<uniform>             u:    Uniforms;
@group(0) @binding(1) var<storage,read>        rgba: array<u32>;
@group(0) @binding(2) var<storage,read_write>  Y:    array<f32>;
@group(0) @binding(3) var<storage,read_write>  Cb:   array<f32>;
@group(0) @binding(4) var<storage,read_write>  Cr:   array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let p = rgba[gid.x];
  let r = f32((p >>  0u) & 0xFFu) / 255.0;
  let g = f32((p >>  8u) & 0xFFu) / 255.0;
  let b = f32((p >> 16u) & 0xFFu) / 255.0;
  Y[gid.x]  =  0.299*r + 0.587*g + 0.114*b;
  Cb[gid.x] = -0.169*r - 0.331*g + 0.500*b + 0.5;
  Cr[gid.x] =  0.500*r - 0.419*g - 0.081*b + 0.5;
}
`;

// Bilateral denoise on Y channel (edge-preserving smoothing)
const SHADER_BILATERAL = /* wgsl */`
struct Uniforms {
  width:      u32,
  height:     u32,
  sigmaSpace: f32,
  sigmaColor: f32,
}

@group(0) @binding(0) var<uniform>            u:   Uniforms;
@group(0) @binding(1) var<storage,read>       src: array<f32>;
@group(0) @binding(2) var<storage,read_write> dst: array<f32>;

fn rd(x: i32, y: i32) -> f32 {
  return src[u32(clamp(y, 0, i32(u.height)-1)) * u.width
           + u32(clamp(x, 0, i32(u.width)-1))];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let center = rd(x, y);
  var sum  = 0.0;
  var wsum = 0.0;
  let r = 3;  // kernel radius
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let v = rd(x+dx, y+dy);
      let spaceDist = f32(dx*dx + dy*dy);
      let colorDist = (v - center) * (v - center);
      let w = exp(-spaceDist / (2.0*u.sigmaSpace*u.sigmaSpace))
            * exp(-colorDist / (2.0*u.sigmaColor*u.sigmaColor));
      sum  += v * w;
      wsum += w;
    }
  }
  dst[gid.y * u.width + gid.x] = sum / wsum;
}
`;

// CLAHE — build local histogram per tile, then equalize
// (Simplified: we compute tile CDF then map each pixel)
const SHADER_CLAHE_HIST = /* wgsl */`
struct Uniforms {
  width:      u32,
  height:     u32,
  tileW:      u32,
  tileH:      u32,
  numTilesX:  u32,
  numTilesY:  u32,
  clipLimit:  f32,
  _p:         u32,
}

// Each tile produces a 256-bin histogram
@group(0) @binding(0) var<uniform>            u:     Uniforms;
@group(0) @binding(1) var<storage,read>       Y:     array<f32>;
@group(0) @binding(2) var<storage,read_write> hists: array<atomic<u32>>;  // [numTiles * 256]

var<workgroup> localHist: array<atomic<u32>, 256>;

@compute @workgroup_size(256)
fn main(
  @builtin(workgroup_id)        wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
) {
  // wid.x = tile index
  atomicStore(&localHist[lid.x], 0u);
  workgroupBarrier();

  let tileIdx = wid.x;
  let tx = tileIdx % u.numTilesX;
  let ty = tileIdx / u.numTilesX;
  let x0 = tx * u.tileW;
  let y0 = ty * u.tileH;
  let x1 = min(x0 + u.tileW, u.width);
  let y1 = min(y0 + u.tileH, u.height);
  let tilePixels = (x1 - x0) * (y1 - y0);

  // Stride over pixels using lid.x
  let total = tilePixels;
  for (var i = lid.x; i < total; i += 256u) {
    let lx = x0 + (i % (x1 - x0));
    let ly = y0 + (i / (x1 - x0));
    if (lx < x1 && ly < y1) {
      let val = u32(clamp(Y[ly * u.width + lx], 0.0, 1.0) * 255.0);
      atomicAdd(&localHist[val], 1u);
    }
  }
  workgroupBarrier();

  // Write local hist to global
  atomicStore(&hists[tileIdx * 256u + lid.x], atomicLoad(&localHist[lid.x]));
}
`;

// CDF + equalization map per tile
const SHADER_CLAHE_CDF = /* wgsl */`
struct Uniforms {
  numTiles:  u32,
  clipLimit: u32,
  _p0:       u32,
  _p1:       u32,
}

@group(0) @binding(0) var<uniform>            u:    Uniforms;
@group(0) @binding(1) var<storage,read_write> hist: array<u32>;    // [numTiles * 256]
@group(0) @binding(2) var<storage,read_write> lut:  array<f32>;   // [numTiles * 256]

var<workgroup> wgHist: array<u32, 256>;

@compute @workgroup_size(256)
fn main(
  @builtin(workgroup_id)        wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
) {
  let tile = wid.x;
  if (tile >= u.numTiles) { return; }

  let base = tile * 256u;
  wgHist[lid.x] = hist[base + lid.x];
  workgroupBarrier();

  // Clip histogram
  if (wgHist[lid.x] > u.clipLimit) { wgHist[lid.x] = u.clipLimit; }
  workgroupBarrier();

  // Prefix sum (inclusive scan) for CDF
  for (var stride = 1u; stride < 256u; stride <<= 1u) {
    let val = select(0u, wgHist[lid.x - stride], lid.x >= stride);
    workgroupBarrier();
    wgHist[lid.x] += val;
    workgroupBarrier();
  }

  // Normalize CDF to [0,1]
  let cdfMin = wgHist[0];
  let cdfMax = wgHist[255];
  let denom  = f32(cdfMax - cdfMin);
  let mapped = select(0.0, f32(wgHist[lid.x] - cdfMin) / denom, denom > 0.0);
  lut[base + lid.x] = clamp(mapped, 0.0, 1.0);
}
`;

// Apply bilinearly-interpolated CLAHE LUT to each pixel
const SHADER_CLAHE_APPLY = /* wgsl */`
struct Uniforms {
  width:     u32,
  height:    u32,
  tileW:     u32,
  tileH:     u32,
  numTilesX: u32,
  numTilesY: u32,
  _p0:       u32,
  _p1:       u32,
}

@group(0) @binding(0) var<uniform>            u:    Uniforms;
@group(0) @binding(1) var<storage,read>       Y:    array<f32>;
@group(0) @binding(2) var<storage,read>       lut:  array<f32>;  // [numTiles * 256]
@group(0) @binding(3) var<storage,read_write> Yeq:  array<f32>;  // equalized

fn tileIdx(tx: u32, ty: u32) -> u32 { return ty * u.numTilesX + tx; }

fn lutVal(tx: u32, ty: u32, bin: u32) -> f32 {
  let ti = tileIdx(
    clamp(tx, 0u, u.numTilesX - 1u),
    clamp(ty, 0u, u.numTilesY - 1u)
  );
  return lut[ti * 256u + bin];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let v = Y[gid.y * u.width + gid.x];
  let bin = u32(clamp(v, 0.0, 1.0) * 255.0);

  // Tile coordinates (floating)
  let fx = (f32(gid.x) + 0.5) / f32(u.tileW) - 0.5;
  let fy = (f32(gid.y) + 0.5) / f32(u.tileH) - 0.5;

  let tx0 = u32(max(0.0, floor(fx)));
  let ty0 = u32(max(0.0, floor(fy)));
  let tx1 = tx0 + 1u;
  let ty1 = ty0 + 1u;
  let ax  = fract(max(0.0, fx));
  let ay  = fract(max(0.0, fy));

  // Bilinear interpolation of LUT values
  let v00 = lutVal(tx0, ty0, bin);
  let v10 = lutVal(tx1, ty0, bin);
  let v01 = lutVal(tx0, ty1, bin);
  let v11 = lutVal(tx1, ty1, bin);
  let eq  = mix(mix(v00, v10, ax), mix(v01, v11, ax), ay);

  Yeq[gid.y * u.width + gid.x] = eq;
}
`;

// Unsharp masking: output = clamp(Y + amount*(Y - blur))
const SHADER_UNSHARP = /* wgsl */`
struct Uniforms { n: u32, amount: f32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:    Uniforms;
@group(0) @binding(1) var<storage,read>       Y:    array<f32>;
@group(0) @binding(2) var<storage,read>       blur: array<f32>;
@group(0) @binding(3) var<storage,read_write> dst:  array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let sharp = Y[gid.x] + u.amount * (Y[gid.x] - blur[gid.x]);
  dst[gid.x] = clamp(sharp, 0.0, 1.0);
}
`;

// Gamma correction
const SHADER_GAMMA = /* wgsl */`
struct Uniforms { n: u32, gamma: f32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:   Uniforms;
@group(0) @binding(1) var<storage,read>       src: array<f32>;
@group(0) @binding(2) var<storage,read_write> dst: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  dst[gid.x] = pow(clamp(src[gid.x], 0.0, 1.0), 1.0 / u.gamma);
}
`;

// Reconstruct RGBA from enhanced Y + original Cb, Cr
const SHADER_YCC_TO_RGB = /* wgsl */`
struct Uniforms { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>            u:    Uniforms;
@group(0) @binding(1) var<storage,read>       Y:    array<f32>;
@group(0) @binding(2) var<storage,read>       Cb:   array<f32>;
@group(0) @binding(3) var<storage,read>       Cr:   array<f32>;
@group(0) @binding(4) var<storage,read_write> rgba: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let y  = Y[gid.x];
  let cb = Cb[gid.x] - 0.5;
  let cr = Cr[gid.x] - 0.5;
  let r = clamp(y + 1.402*cr,            0.0, 1.0);
  let g = clamp(y - 0.344*cb - 0.714*cr, 0.0, 1.0);
  let b = clamp(y + 1.772*cb,            0.0, 1.0);
  let ri = u32(r * 255.0);
  let gi = u32(g * 255.0);
  let bi = u32(b * 255.0);
  rgba[gid.x] = ri | (gi << 8u) | (bi << 16u) | 0xFF000000u;
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

const TILE_SIZE = 64;

export class AdaptiveEnhanceStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    const mk = (src, lbl) => gpuContext.createComputePipeline(gpuContext.createShaderModule(src, lbl), 'main');
    this._p = {
      toYcc:       mk(SHADER_RGB_TO_YCC,   'enh:toycc'),
      bilateral:   mk(SHADER_BILATERAL,    'enh:bilateral'),
      claheHist:   mk(SHADER_CLAHE_HIST,   'enh:clahehist'),
      claheCDF:    mk(SHADER_CLAHE_CDF,    'enh:claheCDF'),
      claheApply:  mk(SHADER_CLAHE_APPLY,  'enh:claheApply'),
      unsharp:     mk(SHADER_UNSHARP,      'enh:unsharp'),
      gamma:       mk(SHADER_GAMMA,        'enh:gamma'),
      toRGB:       mk(SHADER_YCC_TO_RGB,   'enh:torgb'),
    };
  }

  /**
   * @param {Tensor} imageTensor - [H*W] u32 packed RGBA8
   * @param {IQAResult} iqaResult
   * @returns {Promise<{enhancedTensor: Tensor}>}
   */
  async run(imageTensor, iqaResult) {
    gpuContext.assertReady();
    await this._build();

    const N = imageTensor.numel;
    // Infer H,W from shape
    const [H, W] = imageTensor.shape.length === 2
      ? imageTensor.shape
      : [Math.round(Math.sqrt(N)), Math.round(Math.sqrt(N))];

    const p = this._p;

    // ── 1. RGB → YCbCr ────────────────────────────────────────────────────
    const Y  = new Tensor([H, W], 'f32', 0, 'enh:Y');
    const Cb = new Tensor([H, W], 'f32', 0, 'enh:Cb');
    const Cr = new Tensor([H, W], 'f32', 0, 'enh:Cr');
    {
      const u = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.toYcc.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), imageTensor.bindingEntry(1, true),
                  Y.bindingEntry(2), Cb.bindingEntry(3), Cr.bindingEntry(4)],
      });
      gpuContext.dispatch(p.toYcc, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── 2. Bilateral denoise (only if noisy) ──────────────────────────────
    const sigmaColor = iqaResult.noiseScore < 0.5 ? 0.08 : 0.04;
    const Ydenoised = new Tensor([H, W], 'f32', 0, 'enh:Yd');
    {
      const u = createUniformBuffer({ width: W, height: H, sigmaSpace: 2.5, sigmaColor });
      const bg = gpuContext.device.createBindGroup({
        layout: p.bilateral.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), Y.bindingEntry(1, true), Ydenoised.bindingEntry(2)],
      });
      gpuContext.dispatch(p.bilateral, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    }

    // ── 3. CLAHE ──────────────────────────────────────────────────────────
    const numTilesX = Math.ceil(W / TILE_SIZE);
    const numTilesY = Math.ceil(H / TILE_SIZE);
    const numTiles  = numTilesX * numTilesY;
    const clipLimit = Math.round(TILE_SIZE * TILE_SIZE * 0.04);

    const histBuf = new Tensor([numTiles * 256], 'u32', 0, 'enh:hist');
    const lutBuf  = new Tensor([numTiles * 256], 'f32', 0, 'enh:lut');
    const Yeq     = new Tensor([H, W], 'f32', 0, 'enh:Yeq');
    {
      const uH = createUniformBuffer({ width: W, height: H, tileW: TILE_SIZE, tileH: TILE_SIZE,
                                        numTilesX, numTilesY, clipLimit: clipLimit / 1000, _p: 0 });
      const bgH = gpuContext.device.createBindGroup({
        layout: p.claheHist.getBindGroupLayout(0),
        entries: [uH.bindingEntry(0), Ydenoised.bindingEntry(1, true), histBuf.bindingEntry(2)],
      });
      gpuContext.dispatch(p.claheHist, bgH, [numTiles, 1, 1]);

      const uC = createUniformBuffer({ numTiles, clipLimit, _p0: 0, _p1: 0 });
      const bgC = gpuContext.device.createBindGroup({
        layout: p.claheCDF.getBindGroupLayout(0),
        entries: [uC.bindingEntry(0), histBuf.bindingEntry(1), lutBuf.bindingEntry(2)],
      });
      gpuContext.dispatch(p.claheCDF, bgC, [numTiles, 1, 1]);

      const uA = createUniformBuffer({ width: W, height: H, tileW: TILE_SIZE, tileH: TILE_SIZE,
                                        numTilesX, numTilesY, _p0: 0, _p1: 0 });
      const bgA = gpuContext.device.createBindGroup({
        layout: p.claheApply.getBindGroupLayout(0),
        entries: [uA.bindingEntry(0), Ydenoised.bindingEntry(1, true),
                  lutBuf.bindingEntry(2, true), Yeq.bindingEntry(3)],
      });
      gpuContext.dispatch(p.claheApply, bgA, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    }

    // ── 4. Unsharp masking (if blurry) ────────────────────────────────────
    const amount = iqaResult.blurScore < 0.5 ? 0.8 : 0.3;
    // Blur the equalized Y lightly for USM
    const blurTmp1 = new Tensor([H, W], 'f32', 0, 'enh:btmp1');
    const blurTmp2 = new Tensor([H, W], 'f32', 0, 'enh:btmp2');
    {
      // Quick single-pass cheap blur for USM reference
      const uBH = createUniformBuffer({ width: W, height: H, sigma: 1.5, radius: 4 });
      const uBV = createUniformBuffer({ width: W, height: H, sigma: 1.5, radius: 4 });
      const gaussH = gpuContext.createComputePipeline(
        gpuContext.createShaderModule(/* inline simple gaussian */ `
struct U { width: u32, height: u32, sigma: f32, radius: u32, }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage,read> src: array<f32>;
@group(0) @binding(2) var<storage,read_write> dst: array<f32>;
fn gw(d: f32, s: f32) -> f32 { return exp(-(d*d)/(2.0*s*s)); }
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  var sum = 0.0; var wsum = 0.0; let r = i32(u.radius);
  for (var dx = -r; dx <= r; dx++) {
    let sx = u32(clamp(i32(gid.x)+dx, 0, i32(u.width)-1));
    let w = gw(f32(dx), u.sigma); sum += src[gid.y*u.width+sx]*w; wsum += w;
  }
  dst[gid.y*u.width+gid.x] = sum/wsum;
}`, 'enh:gH'), 'main');
      const bgGH = gpuContext.device.createBindGroup({
        layout: gaussH.getBindGroupLayout(0),
        entries: [uBH.bindingEntry(0), Yeq.bindingEntry(1, true), blurTmp1.bindingEntry(2)],
      });
      gpuContext.dispatch(gaussH, bgGH, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    }

    const Ysharp = new Tensor([H, W], 'f32', 0, 'enh:Ysharp');
    {
      const uU = createUniformBuffer({ n: N, amount, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.unsharp.getBindGroupLayout(0),
        entries: [uU.bindingEntry(0), Yeq.bindingEntry(1, true),
                  blurTmp1.bindingEntry(2, true), Ysharp.bindingEntry(3)],
      });
      gpuContext.dispatch(p.unsharp, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── 5. Gamma correction ───────────────────────────────────────────────
    const gamma = iqaResult.meanLuminance < 0.35 ? 1.3
                : iqaResult.meanLuminance > 0.75 ? 0.8 : 1.0;
    const Ygamma = new Tensor([H, W], 'f32', 0, 'enh:Yg');
    {
      const uG = createUniformBuffer({ n: N, gamma, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.gamma.getBindGroupLayout(0),
        entries: [uG.bindingEntry(0), Ysharp.bindingEntry(1, true), Ygamma.bindingEntry(2)],
      });
      gpuContext.dispatch(p.gamma, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── 6. YCbCr → RGB ────────────────────────────────────────────────────
    const enhancedTensor = new Tensor([H, W], 'u32', 0, 'enh:out');
    {
      const uR = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.toRGB.getBindGroupLayout(0),
        entries: [uR.bindingEntry(0), Ygamma.bindingEntry(1, true),
                  Cb.bindingEntry(2, true), Cr.bindingEntry(3, true),
                  enhancedTensor.bindingEntry(4)],
      });
      gpuContext.dispatch(p.toRGB, bg, [Math.ceil(N / 256), 1, 1]);
    }

    await gpuContext.sync();

    // Cleanup
    [Y, Cb, Cr, Ydenoised, histBuf, lutBuf, Yeq,
     blurTmp1, blurTmp2, Ysharp, Ygamma].forEach(t => t.destroy());

    return { enhancedTensor };
  }
}
