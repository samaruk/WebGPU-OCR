// src/stages/stage09_crop_warp.js
// GPU: perspective_warp.wgsl per polygon → crops packed into NCHW batch
// Each crop is normalized to [32, cropWidth] grayscale
import { BaseStage } from './base/BaseStage.js';

const SHADER_WARP      = './src/shaders/vision/perspective_warp.wgsl';
const SHADER_CROP_WARP = './src/shaders/crops/warp_crop.wgsl';

const CROP_H   = 32;
const MAX_CROP_W = 320;

export default class Stage09_CropWarp extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { grayTensor, polygons, imageMeta } = this.data;
    const { data: grayData, width: GW, height: GH } = grayTensor;

    await this.loadShaders([SHADER_WARP, SHADER_CROP_WARP]);

    const device = this.device;
    const { default: PCache } = await import('../gpu/PipelineCache.js');
    const cache = this.ctx.pipelineCache ?? (this.ctx.pipelineCache = new PCache(device));

    // Upload full gray image to GPU once
    const grayBuf = device.createBuffer({ size: GW*GH*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST, mappedAtCreation:true });
    new Float32Array(grayBuf.getMappedRange()).set(grayData); grayBuf.unmap();

    const warpPL = await cache.get(SHADER_WARP);

    const crops = [];
    const MAXN  = Math.min(polygons.length, 256); // cap for memory

    for (let pi = 0; pi < MAXN; pi++) {
      const p = polygons[pi];
      // Estimate crop width proportional to polygon aspect ratio
      const ar = Math.max(0.5, p.gw / Math.max(1, p.gh));
      const cropW = Math.min(MAX_CROP_W, Math.max(8, Math.round(CROP_H * ar)));

      const cropBuf = device.createBuffer({ size: cropW*CROP_H*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST });

      // Identity homography (axis-aligned rectangle warp)
      const sx = p.gw / cropW, sy = p.gh / CROP_H;
      const warpUni = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST, mappedAtCreation:true });
      new Float32Array(warpUni.getMappedRange()).set([
        GW, GH, cropW, CROP_H,
        sx, 0, p.gx,     // h00 h01 h02
        0, sy, p.gy,     // h10 h11 h12
        0,  0, 1,        // h20 h21 h22
        0,               // pad
      ]);
      warpUni.unmap();

      const warpBG = device.createBindGroup({
        layout: warpPL.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: grayBuf } },
          { binding: 1, resource: { buffer: cropBuf } },
          { binding: 2, resource: { buffer: warpUni } },
        ],
      });

      const enc = device.createCommandEncoder({ label: `crop-warp-${pi}` });
      const pass = enc.beginComputePass();
      pass.setPipeline(warpPL); pass.setBindGroup(0, warpBG);
      pass.dispatchWorkgroups(Math.ceil(cropW/8), Math.ceil(CROP_H/8));
      pass.end();
      device.queue.submit([enc.finish()]);

      crops.push({ buffer: cropBuf, width: cropW, height: CROP_H, polygon: p, polyIdx: pi });
    }

    await device.queue.onSubmittedWorkDone();
    const gpuMs = performance.now() - t0;

    // Readback crops for ONNX (CPU-side Float32Arrays per crop)
    const cropArrays = await Promise.all(
      crops.map(async c => {
        const data = await this.ctx.gpuCtx.readback(c.buffer, c.width * c.height * 4);
        return { ...c, data };
      })
    );

    this.data.cropBatch = cropArrays;
    this.bus.emit('log', { level: 'ok', msg: `Stage09: ${cropArrays.length} crops warped in ${gpuMs.toFixed(1)}ms` });

    // ── Visualize: mosaic of first N crops ────────────────────────
    const cv = this.canvas('stage09');
    if (cv && cropArrays.length > 0) {
      const COLS = Math.min(cropArrays.length, 8);
      const ROWS = Math.ceil(Math.min(cropArrays.length, 32) / COLS);
      cv.width  = COLS * MAX_CROP_W;
      cv.height = ROWS * (CROP_H + 4);
      const ctx2d = cv.getContext('2d');
      ctx2d.fillStyle = '#06070d'; ctx2d.fillRect(0, 0, cv.width, cv.height);

      for (let i = 0; i < Math.min(cropArrays.length, COLS*ROWS); i++) {
        const c  = cropArrays[i];
        const cx = (i % COLS) * MAX_CROP_W;
        const cy = Math.floor(i / COLS) * (CROP_H + 4);
        const img2 = ctx2d.createImageData(c.width, CROP_H);
        for (let px = 0; px < c.width * CROP_H; px++) {
          const v = Math.round(c.data[px] * 255);
          img2.data[px*4]=v; img2.data[px*4+1]=v; img2.data[px*4+2]=v; img2.data[px*4+3]=255;
        }
        ctx2d.putImageData(img2, cx, cy);
        ctx2d.strokeStyle = 'rgba(0,212,255,0.3)'; ctx2d.lineWidth=0.5;
        ctx2d.strokeRect(cx, cy, c.width, CROP_H);
      }
      this.badge(cv, `${cropArrays.length} Crops`, '#00d4ff');
    }

    this.setGpuMs(gpuMs);
  }
}
