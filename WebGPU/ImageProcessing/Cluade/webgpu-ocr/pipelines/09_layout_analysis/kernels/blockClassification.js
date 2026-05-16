
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class BlockClassificationKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./blockClassification.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'blockClassification', code);
  }
  run(enc, blockFeatBuf, blockClassBuf, N, D) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([N, D]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: blockFeatBuf  } },
        { binding: 1, resource: { buffer: blockClassBuf } },
        { binding: 2, resource: { buffer: params        } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'blockClassification' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
