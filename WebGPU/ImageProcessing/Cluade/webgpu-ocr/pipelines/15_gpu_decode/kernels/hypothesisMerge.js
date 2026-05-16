
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
export class HypothesisMergeKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./hypothesisMerge.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'hypothesisMerge', code);
  }
  run(enc, tokensBuf, scoresBuf, mergedBuf, beamWidth, seqLen) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([beamWidth, seqLen]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: tokensBuf } },
        { binding: 1, resource: { buffer: scoresBuf } },
        { binding: 2, resource: { buffer: mergedBuf } },
        { binding: 3, resource: { buffer: params    } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'hypothesisMerge' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1);
    pass.end();
  }
}
