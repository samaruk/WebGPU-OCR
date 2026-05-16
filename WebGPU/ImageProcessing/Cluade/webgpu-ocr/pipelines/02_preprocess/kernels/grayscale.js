
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { makeUniform, dispatch2D } from '../../../core/dispatch.js';

export class GrayscaleKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./grayscale.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'grayscale', code);
  }

  run(enc, rgbaBuf, grayBuf, W, H) {
    const params = makeUniform(this.device, new Uint32Array([W, H]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rgbaBuf } },
        { binding: 1, resource: { buffer: grayBuf } },
        { binding: 2, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'grayscale' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
