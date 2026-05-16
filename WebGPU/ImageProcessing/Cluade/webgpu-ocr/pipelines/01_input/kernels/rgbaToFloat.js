
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { makeUniform, dispatch2D } from '../../../core/dispatch.js';

export class RGBAToFloatKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./rgbaToFloat.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'rgbaToFloat', code);
  }

  run(commandEncoder, rgbaBuf, planarBuf, width, height) {
    const params = makeUniform(this.device, new Uint32Array([width, height]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rgbaBuf  } },
        { binding: 1, resource: { buffer: planarBuf } },
        { binding: 2, resource: { buffer: params    } },
      ],
    });
    const pass = commandEncoder.beginComputePass({ label: 'rgbaToFloat' });
    dispatch2D(pass, this.pipeline, bg, width, height);
    pass.end();
  }
}
