
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class EdgeWeightsKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./edgeWeights.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'edgeWeights', code);
  }
  run(enc, nodeFBuf, adjBuf, edgeWBuf, N, D) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([N, D]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: nodeFBuf } },
        { binding: 1, resource: { buffer: adjBuf   } },
        { binding: 2, resource: { buffer: edgeWBuf } },
        { binding: 3, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'edgeWeights' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 16), wgCount(N, 16));
    pass.end();
  }
}
