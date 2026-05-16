
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';
export class BlockSegmentationKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./blockSegmentation.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'blockSegmentation', code);
  }
  run(enc, inBuf, blocksBuf, W, H, blockH = 32, blockW = 32) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, blockH, blockW]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf     } },
        { binding: 1, resource: { buffer: blocksBuf } },
        { binding: 2, resource: { buffer: params    } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'blockSegmentation' });
    dispatch2D(pass, this.pipeline, bg, Math.ceil(W/blockW), Math.ceil(H/blockH));
    pass.end();
  }
}
