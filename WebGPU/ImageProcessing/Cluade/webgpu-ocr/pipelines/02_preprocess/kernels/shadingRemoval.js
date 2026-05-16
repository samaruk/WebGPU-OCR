
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';

export class ShadingRemovalKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./shadingRemoval.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'shadingRemoval', code);
  }

  run(enc, inBuf, outBuf, W, H, radius = 40) {
    const ab = new ArrayBuffer(12);
    new Uint32Array(ab).set([W, H, radius]);
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);

    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'shadingRemoval' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
