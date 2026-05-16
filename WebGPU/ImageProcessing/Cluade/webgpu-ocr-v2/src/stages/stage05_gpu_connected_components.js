// src/stages/stage05_gpu_connected_components.js
// GPU parallel connected component labeling (multi-pass propagation)
// Uses connected_components.wgsl + CPU UnionFind to resolve chains
// NO full pixel readback during pipeline — only label array (U32)
import { BaseStage } from './base/BaseStage.js';
import { UnionFind }  from '../gpu/UnionFind.js';

const SHADER_CC = './src/shaders/postprocess/connected_components.wgsl';

export default class Stage05_GPUConnectedComponents extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { binMap } = this.data;
    const { data: binData, width: W, height: H } = binMap;
    const N   = W * H;
    const thresh = this.config.detection.binaryThreshold;

    // ── Load shader ───────────────────────────────────────────────
    await this.loadShaders([SHADER_CC]);

    const device = this.device;
      const { PipelineCache } = await import('../gpu/PipelineCache.js');
      const cache = this.ctx.pipelineCache ?? (this.ctx.pipelineCache = new PipelineCache(device));

    // Upload binary map
    const binBuf = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST, mappedAtCreation:true });
    new Float32Array(binBuf.getMappedRange()).set(binData); binBuf.unmap();

    // Label buffer (u32) — initialize to 0
    const labelBuf = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(labelBuf, 0, new Uint32Array(N));

    const ccUni = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST, mappedAtCreation:true });
    new Float32Array(ccUni.getMappedRange()).set([W, H, thresh, 0]);
    ccUni.unmap();

    const ccPL = await cache.get(SHADER_CC);
    const ccBG = device.createBindGroup({
      layout: ccPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: binBuf } },
        { binding: 1, resource: { buffer: labelBuf } },
        { binding: 2, resource: { buffer: ccUni } },
      ],
    });

    // Multi-pass label propagation (log2(max_component_size) passes sufficient)
    const PASSES = 12;
    for (let p = 0; p < PASSES; p++) {
      const enc = device.createCommandEncoder({ label: `cc-pass-${p}` });
      const pass = enc.beginComputePass();
      pass.setPipeline(ccPL); pass.setBindGroup(0, ccBG);
      pass.dispatchWorkgroups(Math.ceil(W/8), Math.ceil(H/8));
      pass.end();
      device.queue.submit([enc.finish()]);
    }
    await device.queue.onSubmittedWorkDone();
    const gpuMs = performance.now() - t0;

    // ── Readback only label array (cheap — 4 bytes/pixel) ─────────
    const rawLabels = await this.ctx.gpuCtx.readbackU32(labelBuf, N*4);

    // ── CPU: UnionFind chain resolution ───────────────────────────
    const resolvedLabels = UnionFind.resolve(rawLabels, W, H);

    this.data.labelMap = { data: resolvedLabels, width: W, height: H, buffer: labelBuf };

    // ── Count unique labels ───────────────────────────────────────
    const unique = new Set(resolvedLabels.filter(l => l > 0));
    this.bus.emit('log', { level: 'ok', msg: `Stage05: ${unique.size} components in ${gpuMs.toFixed(1)}ms` });

    // ── Visualize: colorized label map ────────────────────────────
    const cv = this.canvas('stage05');
    if (cv) {
      cv.width = W; cv.height = H;
      const ctx2d = cv.getContext('2d');
      const img = ctx2d.createImageData(W, H);
      const palette = Array.from({ length: unique.size + 1 }, (_,i) => {
        const h = (i * 137.508) % 360;
        return hslToRgb(h/360, 0.7, 0.55);
      });
      const labelList = [...unique];
      const labelIdx = new Map(labelList.map((l,i) => [l, i+1]));
      for (let i = 0; i < N; i++) {
        const l = resolvedLabels[i];
        const [r,g,b] = l ? (palette[labelIdx.get(l) % palette.length] ?? [60,60,60]) : [8,8,18];
        img.data[i*4]=r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=255;
      }
      ctx2d.putImageData(img, 0, 0);
      this.badge(cv, `${unique.size} Regions`, '#00e676');
    }

    this.setGpuMs(gpuMs);
  }
}

function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  const hue2rgb = (t) => {
    if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  };
  return [Math.round(hue2rgb(h+1/3)*255), Math.round(hue2rgb(h)*255), Math.round(hue2rgb(h-1/3)*255)];
}
