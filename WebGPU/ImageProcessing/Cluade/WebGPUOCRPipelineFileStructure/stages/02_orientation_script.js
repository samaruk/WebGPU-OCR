/**
 * 02_orientation_script.js — Orientation & Script Detection
 *
 * Detects page orientation (0°, 90°, 180°, 270°) via gradient-histogram
 * voting on the luma image, and estimates the dominant script direction
 * (LTR, RTL, TTB) from textline run statistics.
 *
 * GPU pipeline:
 *   1. Sobel gradient magnitude + angle per pixel
 *   2. Histogram accumulation over angle buckets (4 × 45° bins)
 *   3. Peak detection → rotation angle
 *   4. Horizontal vs vertical run-length analysis → script direction
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

const SHADER_SOBEL = /* wgsl */`
struct Uniforms {
  width:  u32,
  height: u32,
  _p0:    u32,
  _p1:    u32,
}

@group(0) @binding(0) var<uniform>            u: Uniforms;
@group(0) @binding(1) var<storage,read>       luma: array<f32>;    // [H*W]
@group(0) @binding(2) var<storage,read_write> grad:  array<f32>;   // magnitude [H*W]
@group(0) @binding(3) var<storage,read_write> angle: array<f32>;   // angle [H*W] in [0, pi)

fn s(x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(u.width)  - 1);
  let cy = clamp(y, 0, i32(u.height) - 1);
  return luma[u32(cy) * u.width + u32(cx)];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);

  let gx = -s(x-1,y-1) + s(x+1,y-1)
           -2.0*s(x-1,y) + 2.0*s(x+1,y)
           -s(x-1,y+1) + s(x+1,y+1);

  let gy = -s(x-1,y-1) - 2.0*s(x,y-1) - s(x+1,y-1)
           +s(x-1,y+1) + 2.0*s(x,y+1) + s(x+1,y+1);

  let mag = sqrt(gx*gx + gy*gy);
  // atan2 returns (-pi, pi]; map to [0, pi)
  var ang = atan2(gy, gx);
  if (ang < 0.0) { ang += 3.14159265; }
  if (ang >= 3.14159265) { ang -= 3.14159265; }

  let idx = gid.y * u.width + gid.x;
  grad[idx]  = mag;
  angle[idx] = ang;
}
`;

// Accumulate orientation histogram: 8 bins over [0, pi)
const SHADER_ORIENT_HIST = /* wgsl */`
struct Uniforms {
  n:     u32,
  bins:  u32,
  _p0:   u32,
  _p1:   u32,
}

@group(0) @binding(0) var<uniform>            u: Uniforms;
@group(0) @binding(1) var<storage,read>       grad:  array<f32>;
@group(0) @binding(2) var<storage,read>       angle: array<f32>;
@group(0) @binding(3) var<storage,read_write> hist:  array<atomic<u32>>;  // [bins]

var<workgroup> localHist: array<atomic<u32>, 8>;

@compute @workgroup_size(256)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id)  lid: vec3<u32>,
) {
  // Init shared memory
  if (lid.x < u.bins) { atomicStore(&localHist[lid.x], 0u); }
  workgroupBarrier();

  if (gid.x < u.n) {
    let mag = grad[gid.x];
    if (mag > 0.05) {  // threshold weak gradients
      let ang = angle[gid.x];                                // [0, pi)
      let bin = u32(ang / 3.14159265 * f32(u.bins)) % u.bins;
      let weight = u32(mag * 1000.0);
      atomicAdd(&localHist[bin], weight);
    }
  }
  workgroupBarrier();

  if (lid.x < u.bins) {
    atomicAdd(&hist[lid.x], atomicLoad(&localHist[lid.x]));
  }
}
`;

// Run-length analysis for H vs V runs (script direction)
const SHADER_RUNLENGTH = /* wgsl */`
struct Uniforms {
  width:     u32,
  height:    u32,
  threshold: f32,
  _p:        u32,
}

@group(0) @binding(0) var<uniform>            u: Uniforms;
@group(0) @binding(1) var<storage,read>       luma: array<f32>;
@group(0) @binding(2) var<storage,read_write> hRunSum: array<atomic<u32>>;  // [1]
@group(0) @binding(3) var<storage,read_write> vRunSum: array<atomic<u32>>;  // [1]

var<workgroup> wgH: atomic<u32>;
var<workgroup> wgV: atomic<u32>;

@compute @workgroup_size(1, 256)
fn mainH(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id)  lid: vec3<u32>,
) {
  // Each thread handles one row: gid.y = row index
  if (lid.x == 0u) { atomicStore(&wgH, 0u); }
  workgroupBarrier();

  let row = gid.y;
  if (row < u.height) {
    var run = 0u;
    var maxRun = 0u;
    for (var x = 0u; x < u.width; x++) {
      let v = luma[row * u.width + x];
      if (v < u.threshold) {
        run++;
        if (run > maxRun) { maxRun = run; }
      } else {
        run = 0u;
      }
    }
    atomicAdd(&wgH, maxRun);
  }
  workgroupBarrier();
  if (lid.x == 0u) { atomicAdd(&hRunSum[0], atomicLoad(&wgH)); }
}

@compute @workgroup_size(256, 1)
fn mainV(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id)  lid: vec3<u32>,
) {
  // Each thread handles one column: gid.x = col index
  if (lid.y == 0u) { atomicStore(&wgV, 0u); }
  workgroupBarrier();

  let col = gid.x;
  if (col < u.width) {
    var run = 0u;
    var maxRun = 0u;
    for (var y = 0u; y < u.height; y++) {
      let v = luma[y * u.width + col];
      if (v < u.threshold) {
        run++;
        if (run > maxRun) { maxRun = run; }
      } else {
        run = 0u;
      }
    }
    atomicAdd(&wgV, maxRun);
  }
  workgroupBarrier();
  if (lid.x == 0u) { atomicAdd(&vRunSum[0], atomicLoad(&wgV)); }
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

const BINS = 8; // orientation histogram bins (each = 22.5°)

export class OrientationScriptStage {
  constructor() {
    this._pipelines = null;
  }

  async _build() {
    if (this._pipelines) return;

    const sobelMod  = gpuContext.createShaderModule(SHADER_SOBEL,       'orient:sobel');
    const histMod   = gpuContext.createShaderModule(SHADER_ORIENT_HIST, 'orient:hist');
    const runMod    = gpuContext.createShaderModule(SHADER_RUNLENGTH,    'orient:run');

    this._pipelines = {
      sobel:   gpuContext.createComputePipeline(sobelMod, 'main'),
      hist:    gpuContext.createComputePipeline(histMod,  'main'),
      hRun:    gpuContext.createComputePipeline(runMod,   'mainH'),
      vRun:    gpuContext.createComputePipeline(runMod,   'mainV'),
    };
  }

  /**
   * @param {Tensor} lumaTensor - shape [H, W], f32, luminance values 0-1
   * @returns {Promise<OrientationResult>}
   */
  async run(lumaTensor) {
    gpuContext.assertReady();
    await this._build();

    const [H, W] = lumaTensor.shape;
    const N = H * W;
    const p = this._pipelines;

    // ── Sobel ──────────────────────────────────────────────────────────────
    const gradTensor  = new Tensor([H, W], 'f32', 0, 'orient:grad');
    const angleTensor = new Tensor([H, W], 'f32', 0, 'orient:angle');
    {
      const u = createUniformBuffer({ width: W, height: H, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.sobel.getBindGroupLayout(0),
        entries: [
          u.bindingEntry(0),
          lumaTensor.bindingEntry(1, true),
          gradTensor.bindingEntry(2),
          angleTensor.bindingEntry(3),
        ],
      });
      gpuContext.dispatch(p.sobel, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    }

    // ── Orientation histogram ──────────────────────────────────────────────
    const histTensor = Tensor.zeros([BINS], 'u32', 'orient:hist');
    {
      const u = createUniformBuffer({ n: N, bins: BINS, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.hist.getBindGroupLayout(0),
        entries: [
          u.bindingEntry(0),
          gradTensor.bindingEntry(1, true),
          angleTensor.bindingEntry(2, true),
          histTensor.bindingEntry(3),
        ],
      });
      gpuContext.dispatch(p.hist, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── Run-length analysis ────────────────────────────────────────────────
    const hRunBuf = Tensor.zeros([1], 'u32', 'orient:hrun');
    const vRunBuf = Tensor.zeros([1], 'u32', 'orient:vrun');
    {
      const u = createUniformBuffer({ width: W, height: H, threshold: 0.5, _p: 0 });
      const bgH = gpuContext.device.createBindGroup({
        layout: p.hRun.getBindGroupLayout(0),
        entries: [
          u.bindingEntry(0),
          lumaTensor.bindingEntry(1, true),
          hRunBuf.bindingEntry(2),
          vRunBuf.bindingEntry(3),
        ],
      });
      const bgV = gpuContext.device.createBindGroup({
        layout: p.vRun.getBindGroupLayout(0),
        entries: [
          u.bindingEntry(0),
          lumaTensor.bindingEntry(1, true),
          hRunBuf.bindingEntry(2),
          vRunBuf.bindingEntry(3),
        ],
      });
      gpuContext.dispatch(p.hRun, bgH, [1, Math.ceil(H / 256), 1]);
      gpuContext.dispatch(p.vRun, bgV, [Math.ceil(W / 256), 1, 1]);
    }

    await gpuContext.sync();

    // ── CPU analysis ───────────────────────────────────────────────────────
    const histData  = await histTensor.download();  // Uint32Array [BINS]
    const hRunData  = await hRunBuf.download();
    const vRunData  = await vRunBuf.download();

    // Find dominant orientation bin
    let maxBin = 0;
    let maxVal = 0;
    for (let i = 0; i < BINS; i++) {
      if (histData[i] > maxVal) { maxVal = histData[i]; maxBin = i; }
    }

    // Map bin to rotation angle: each bin = 22.5°
    // Bins 0-1 (0-45°): horizontal text   → 0° rotation
    // Bins 2-3 (45-90°): right → down      → 90° rotation
    // Bins 4-5 (90-135°): upside down       → 180° rotation
    // Bins 6-7 (135-180°): left → up        → 270° rotation
    const orientationDeg = [0, 0, 90, 90, 180, 180, 270, 270][maxBin];

    // Script direction from run-lengths
    const hSum = hRunData[0];
    const vSum = vRunData[0];
    const scriptDirection = vSum > hSum * 1.4 ? 'TTB' : 'LTR';

    // Confidence: how dominant is the peak?
    const total = histData.reduce((a, b) => a + b, 0);
    const confidence = total > 0 ? maxVal / total : 0;

    // Cleanup
    gradTensor.destroy();
    angleTensor.destroy();
    histTensor.destroy();
    hRunBuf.destroy();
    vRunBuf.destroy();

    return {
      orientationDeg,
      confidence,
      scriptDirection,
      histData: Array.from(histData),
      needsRotation: orientationDeg !== 0,
    };
  }
}

/**
 * @typedef {Object} OrientationResult
 * @property {0|90|180|270} orientationDeg - detected page rotation
 * @property {number} confidence - 0-1
 * @property {'LTR'|'RTL'|'TTB'} scriptDirection
 * @property {number[]} histData - raw histogram bins
 * @property {boolean} needsRotation
 */
