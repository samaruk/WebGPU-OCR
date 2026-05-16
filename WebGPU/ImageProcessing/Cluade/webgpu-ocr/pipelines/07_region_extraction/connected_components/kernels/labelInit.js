
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../../core/dispatch.js';
export class LabelInitKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./labelInit.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'labelInit', code);
  }
  run(enc, binBuf, labelBuf, W, H, thresh = 0.5) {
    const ab = new ArrayBuffer(12);
    new Uint32Array(ab).set([W, H]);
    new Float32Array(ab, 8)[0] = thresh;
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: binBuf   } },
        { binding: 1, resource: { buffer: labelBuf } },
        { binding: 2, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'labelInit' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
