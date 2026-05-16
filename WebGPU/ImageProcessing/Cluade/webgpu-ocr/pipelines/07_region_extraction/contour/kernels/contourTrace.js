
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../../core/dispatch.js';
export class ContourTraceKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./contourTrace.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'contourTrace', code);
  }
  run(enc, labelBuf, contourBuf, W, H, thresh = 0.1) {
    const ab = new ArrayBuffer(12);
    new Uint32Array(ab).set([W, H]);
    new Float32Array(ab, 8)[0] = thresh;
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: labelBuf   } },
        { binding: 1, resource: { buffer: contourBuf } },
        { binding: 2, resource: { buffer: params     } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'contourTrace' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
