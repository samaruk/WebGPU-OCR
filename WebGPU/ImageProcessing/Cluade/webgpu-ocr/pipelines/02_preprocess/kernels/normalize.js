
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { makeUniform, dispatch2D } from '../../../core/dispatch.js';

export class NormalizeKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./normalize.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'normalize', code);
  }

  run(enc, inBuf, outBuf, W, H,
      mean = [0.485,0.456,0.406], std = [0.229,0.224,0.225]) {
    const params = makeUniform(this.device, new Float32Array([
      W, H,
      mean[0], mean[1], mean[2],
      std[0],  std[1],  std[2],
    ]));
    // Patch ints into the uniform
    const u32view = new Uint32Array([W, H]);
    this.device.queue.writeBuffer(params, 0, u32view);

    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'normalize' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
