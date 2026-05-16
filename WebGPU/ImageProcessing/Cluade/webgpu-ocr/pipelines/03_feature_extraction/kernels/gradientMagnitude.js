
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';

export class GradientMagnitudeKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./gradientMagnitude.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'gradientMagnitude', code);
  }

  run(enc, gxBuf, gyBuf, magBuf, angBuf, W, H) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gxBuf  } },
        { binding: 1, resource: { buffer: gyBuf  } },
        { binding: 2, resource: { buffer: magBuf } },
        { binding: 3, resource: { buffer: angBuf } },
        { binding: 4, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'gradientMagnitude' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
