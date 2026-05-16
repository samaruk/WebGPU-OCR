
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class RotatedBoxesKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./rotatedBoxes.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'rotatedBoxes', code);
  }
  run(enc, bboxBuf, rotBuf, N) {
    const params = this.device.createBuffer({ size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([N]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bboxBuf } },
        { binding: 1, resource: { buffer: rotBuf  } },
        { binding: 2, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'rotatedBoxes' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
