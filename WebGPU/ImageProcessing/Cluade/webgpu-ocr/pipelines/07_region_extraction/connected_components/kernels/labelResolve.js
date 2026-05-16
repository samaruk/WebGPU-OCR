
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../../core/dispatch.js';
export class LabelResolveKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./labelResolve.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'labelResolve', code);
  }
  run(enc, labelInBuf, labelOutBuf, W, H) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: labelInBuf  } },
        { binding: 1, resource: { buffer: labelOutBuf } },
        { binding: 2, resource: { buffer: params      } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'labelResolve' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
