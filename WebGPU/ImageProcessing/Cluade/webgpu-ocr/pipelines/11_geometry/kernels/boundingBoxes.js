
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class BoundingBoxesKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./boundingBoxes.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'boundingBoxes', code);
  }
  run(enc, labelBuf, bboxBuf, W, H, N) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, N]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: labelBuf } },
        { binding: 1, resource: { buffer: bboxBuf  } },
        { binding: 2, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'boundingBoxes' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
