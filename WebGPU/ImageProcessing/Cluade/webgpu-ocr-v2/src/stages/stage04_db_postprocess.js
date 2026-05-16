// src/stages/stage04_db_postprocess.js
// GPU: binarize.wgsl (DB formula) → morphology_open.wgsl → threshold.wgsl
// Produces binary map from probability + threshold maps
import { BaseStage } from './base/BaseStage.js';

const SHADER_BINARIZE  = './src/shaders/postprocess/binarize.wgsl';
const SHADER_MORPH_OPN = './src/shaders/vision/morphology_open.wgsl';
const SHADER_THRESHOLD = './src/shaders/vision/threshold.wgsl';

export default class Stage04_DBPostprocess extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { probMap, threshMap } = this.data;
    const W = probMap.width, H = probMap.height;
    const N = W * H;
    const k = this.config.detection.dbAmplification;

    // ── Load shaders ──────────────────────────────────────────────
    await this.loadShaders([SHADER_BINARIZE, SHADER_MORPH_OPN, SHADER_THRESHOLD]);

    const device = this.device;
      const { PipelineCache } = await import('../gpu/PipelineCache.js');
      const cache = this.ctx.pipelineCache ?? (this.ctx.pipelineCache = new PipelineCache(device));

    // Upload prob/thresh maps to GPU
    const probBuf  = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST, mappedAtCreation:true });
    new Float32Array(probBuf.getMappedRange()).set(probMap.data); probBuf.unmap();

    const thrBuf = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST, mappedAtCreation:true });
    new Float32Array(thrBuf.getMappedRange()).set(threshMap.data); thrBuf.unmap();

    // Output: binary map
    const binBuf = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST });

    // Uniform: [width, height, k, pad]
    const binUni = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST, mappedAtCreation:true });
    new Float32Array(binUni.getMappedRange()).set([W, H, k, 0]);
    binUni.unmap();

    // ── PASS 1: DB binarization ───────────────────────────────────
    const binPL = await cache.get(SHADER_BINARIZE);
    const binBG = device.createBindGroup({
      layout: binPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: probBuf } },
        { binding: 1, resource: { buffer: thrBuf } },
        { binding: 2, resource: { buffer: binBuf } },
        { binding: 3, resource: { buffer: binUni } },
      ],
    });
    let enc = device.createCommandEncoder({ label: 'stage04-binarize' });
    let pass = enc.beginComputePass();
    pass.setPipeline(binPL); pass.setBindGroup(0, binBG);
    pass.dispatchWorkgroups(Math.ceil(W/8), Math.ceil(H/8));
    pass.end();
    this.queue.submit([enc.finish()]);

    // ── PASS 2: Morphological open (erode → dilate) ───────────────
    const erodeBuf = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST });
    const dilatBuf = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST });

    const morphUni = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST, mappedAtCreation:true });
    new Uint32Array(morphUni.getMappedRange()).set([W, H, this.config.detection.dilateIterations, 0]);
    morphUni.unmap();

    const morphPL = await cache.get(SHADER_MORPH_OPN);
    const morphBG = device.createBindGroup({
      layout: morphPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: binBuf } },
        { binding: 1, resource: { buffer: erodeBuf } },
        { binding: 2, resource: { buffer: dilatBuf } },
        { binding: 3, resource: { buffer: morphUni } },
      ],
    });
    enc = device.createCommandEncoder({ label: 'stage04-morph' });
    pass = enc.beginComputePass();
    pass.setPipeline(morphPL); pass.setBindGroup(0, morphBG);
    pass.dispatchWorkgroups(Math.ceil(W/8), Math.ceil(H/8));
    pass.end();
    this.queue.submit([enc.finish()]);
    await this.queue.onSubmittedWorkDone();

    const gpuMs = performance.now() - t0;

    // Readback morphed (dilatBuf) as final binary map
    const binData = await this.ctx.gpuCtx.readback(dilatBuf, N*4);

    this.data.binMap = { data: binData, buffer: dilatBuf, width: W, height: H };

    // ── Visualize ─────────────────────────────────────────────────
    const cv = this.canvas('stage04');
    if (cv) {
      this.renderGraymap(cv, binData, W, H, 'amber');
      this.badge(cv, `BinMap k=${k}`, '#ffb300');
    }

    this.setGpuMs(gpuMs);
    this.bus.emit('log', { level: 'ok', msg: `Stage04: DB binarize+morph in ${gpuMs.toFixed(1)}ms` });
  }
}
