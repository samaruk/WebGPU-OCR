// src/stages/stage02_gpu_preprocess.js
// GPU: resize → normalize (NCHW color) + grayscale (for recognition crops)
// Shaders: preprocess/resize.wgsl, preprocess/normalize.wgsl, preprocess/grayscale.wgsl, preprocess/denoise.wgsl
import { BaseStage } from './base/BaseStage.js';

const SHADER_RESIZE    = './src/shaders/preprocess/resize.wgsl';
const SHADER_NORMALIZE = './src/shaders/preprocess/normalize.wgsl';
const SHADER_GRAYSCALE = './src/shaders/preprocess/grayscale.wgsl';
const SHADER_DENOISE   = './src/shaders/preprocess/denoise.wgsl';

const TARGET_W = 640, TARGET_H = 640;   // DBNet input

export default class Stage02_GPUPreprocess extends BaseStage {
  async execute() {
    const t0    = performance.now();
    const gpt0  = performance.now();
    const { floatRGBA, gpuBuf: srcBuf, width: srcW, height: srcH } = this.data.rawImage;

    // ── Load all shaders upfront via loadShaders() ─────────────────
    await this.loadShaders([SHADER_RESIZE, SHADER_NORMALIZE, SHADER_GRAYSCALE, SHADER_DENOISE]);

    const device = this.device;
    const dstN   = TARGET_W * TARGET_H;

    // ── PASS 1: Resize to 640×640 NCHW float32 ────────────────────
    const resizeDst = device.createBuffer({
      size: 3 * dstN * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const resizeUni = this.makeUniform(new Float32Array([
      srcW, srcH, TARGET_W, TARGET_H  // as f32 (shader reads as u32-compatible)
    ]));
    // Use proper u32 uniform (shader struct uses u32)
    const resizeUniU32 = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint32Array(resizeUniU32.getMappedRange()).set([srcW, srcH, TARGET_W, TARGET_H]);
    resizeUniU32.unmap();

      const { PipelineCache } = await import('../gpu/PipelineCache.js');
      const cache = this.ctx.pipelineCache ?? (this.ctx.pipelineCache = new PipelineCache(device));

    const resizePL = await cache.get(SHADER_RESIZE);
    const resizeBG = device.createBindGroup({
      layout: resizePL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcBuf } },
        { binding: 1, resource: { buffer: resizeDst } },
        { binding: 2, resource: { buffer: resizeUniU32 } },
      ],
    });

    let enc = device.createCommandEncoder({ label: 'stage02-resize' });
    const rPass = enc.beginComputePass();
    rPass.setPipeline(resizePL);
    rPass.setBindGroup(0, resizeBG);
    rPass.dispatchWorkgroups(Math.ceil(TARGET_W/8), Math.ceil(TARGET_H/8));
    rPass.end();
    this.queue.submit([enc.finish()]);

    // ── PASS 2: Normalize in-place ─────────────────────────────────
    const cfg  = this.config.preprocess;
    const mean = cfg.imagenetMean, std = cfg.imagenetStd;
    const normUni = device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const normUniData = new Float32Array(16);
    new Uint32Array(normUniData.buffer).set([TARGET_W, TARGET_H, 3, 0], 0);
    normUniData.set([mean[0], mean[1], mean[2], 0, std[0], std[1], std[2], 0], 4);
    new Float32Array(normUni.getMappedRange()).set(normUniData);
    normUni.unmap();

    const normPL = await cache.get(SHADER_NORMALIZE);
    const normBG = device.createBindGroup({
      layout: normPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: resizeDst } },
        { binding: 1, resource: { buffer: normUni } },
      ],
    });

    enc = device.createCommandEncoder({ label: 'stage02-normalize' });
    const nPass = enc.beginComputePass();
    nPass.setPipeline(normPL);
    nPass.setBindGroup(0, normBG);
    nPass.dispatchWorkgroups(Math.ceil(TARGET_W/8), Math.ceil(TARGET_H/8));
    nPass.end();
    this.queue.submit([enc.finish()]);

    // ── PASS 3: Grayscale version [TARGET_H×TARGET_W] ─────────────
    const grayDst = device.createBuffer({
      size: dstN * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const grayUniU32 = device.createBuffer({
      size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint32Array(grayUniU32.getMappedRange()).set([TARGET_W, TARGET_H, 0, 0]);
    grayUniU32.unmap();

    const grayPL = await cache.get(SHADER_GRAYSCALE);
    const grayBG = device.createBindGroup({
      layout: grayPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: resizeDst } },
        { binding: 1, resource: { buffer: grayDst } },
        { binding: 2, resource: { buffer: grayUniU32 } },
      ],
    });

    enc = device.createCommandEncoder({ label: 'stage02-grayscale' });
    const gPass = enc.beginComputePass();
    gPass.setPipeline(grayPL);
    gPass.setBindGroup(0, grayBG);
    gPass.dispatchWorkgroups(Math.ceil(TARGET_W/8), Math.ceil(TARGET_H/8));
    gPass.end();
    this.queue.submit([enc.finish()]);
    await this.queue.onSubmittedWorkDone();

    const gpuMs = performance.now() - gpt0;

    // ── Readback for visualization ─────────────────────────────────
    const normData = await this.ctx.gpuCtx.readback(resizeDst, 3 * dstN * 4);
    const grayData = await this.ctx.gpuCtx.readback(grayDst, dstN * 4);

    this.data.normTensor = { buffer: resizeDst, width: TARGET_W, height: TARGET_H, data: normData };
    this.data.grayTensor = { buffer: grayDst,   width: TARGET_W, height: TARGET_H, data: grayData };

    // ── Visualize normalized RGB ───────────────────────────────────
    const cv = this.canvas('stage02');
    if (cv) {
      this.renderRGB(cv, normData, TARGET_W, TARGET_H);
      this.badge(cv, `Normalize ${TARGET_W}×${TARGET_H}`, '#ffb300');
    }

    this.setGpuMs(gpuMs);
    this.bus.emit('log', { level: 'ok', msg: `Stage02: resize+normalize+gray in ${gpuMs.toFixed(1)}ms GPU` });
  }
}
