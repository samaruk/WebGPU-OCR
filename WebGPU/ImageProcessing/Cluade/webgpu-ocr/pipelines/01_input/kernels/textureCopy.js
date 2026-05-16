
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { makeUniform, dispatch2D } from '../../../core/dispatch.js';

export class TextureCopyKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./textureCopy.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'textureCopy', code);
  }

  run(commandEncoder, srcBuf, dstBuf, srcW, srcH, dstW, dstH, flipY = false) {
    const params = makeUniform(this.device, new Uint32Array([srcW, srcH, dstW, dstH, flipY ? 1 : 0]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcBuf } },
        { binding: 1, resource: { buffer: dstBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const pass = commandEncoder.beginComputePass({ label: 'textureCopy' });
    dispatch2D(pass, this.pipeline, bg, dstW, dstH);
    pass.end();
  }
}
