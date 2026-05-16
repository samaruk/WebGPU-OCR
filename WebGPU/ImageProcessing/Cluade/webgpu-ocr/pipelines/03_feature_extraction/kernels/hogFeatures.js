
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';

export class HOGFeaturesKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./hogFeatures.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'hogFeatures', code);
  }

  run(enc, magBuf, angBuf, hogBuf, W, H, cellSize = 8, nbins = 9) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, cellSize, nbins]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: magBuf } },
        { binding: 1, resource: { buffer: angBuf } },
        { binding: 2, resource: { buffer: hogBuf } },
        { binding: 3, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'hogFeatures' });
    dispatch2D(pass, this.pipeline, bg, Math.ceil(W/cellSize), Math.ceil(H/cellSize));
    pass.end();
  }
}
