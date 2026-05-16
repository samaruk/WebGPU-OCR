
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { makeUniform, dispatch2D } from '../../../core/dispatch.js';

export class ResizeBilinearKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./resizeBilinear.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'resizeBilinear', code);
  }

  run(enc, srcBuf, dstBuf, srcW, srcH, dstW, dstH, channels = 4) {
    const params = makeUniform(this.device, new Uint32Array([srcW, srcH, dstW, dstH, channels]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcBuf } },
        { binding: 1, resource: { buffer: dstBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'resizeBilinear' });
    dispatch2D(pass, this.pipeline, bg, dstW, dstH);
    pass.end();
  }
}
