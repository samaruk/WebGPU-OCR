
import { loadShader }           from '../../../core/shaderLoader.js';
import { getComputePipeline }   from '../../../core/pipelineCache.js';
import { makeUniform, dispatch2D } from '../../../core/dispatch.js';

export class UploadImageKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./uploadImage.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'uploadImage', code);
  }

  /** src: Uint32Array (packed RGBA), returns GPUBuffer f32 */
  run(commandEncoder, srcBuffer, dstBuffer, width, height) {
    const params = makeUniform(this.device, new Uint32Array([width, height]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcBuffer } },
        { binding: 1, resource: { buffer: dstBuffer } },
        { binding: 2, resource: { buffer: params    } },
      ],
    });
    const pass = commandEncoder.beginComputePass({ label: 'uploadImage' });
    dispatch2D(pass, this.pipeline, bg, width, height);
    pass.end();
  }
}
