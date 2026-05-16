
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class NodeUpdateKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./nodeUpdate.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'nodeUpdate', code);
  }
  run(enc, nodeFBuf, msgBuf, N, D, alpha = 0.5) {
    const ab = new ArrayBuffer(12);
    new Uint32Array(ab).set([N, D]);
    new Float32Array(ab, 8)[0] = alpha;
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: nodeFBuf } },
        { binding: 1, resource: { buffer: msgBuf   } },
        { binding: 2, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'nodeUpdate' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N * D, 256));
    pass.end();
  }
}
