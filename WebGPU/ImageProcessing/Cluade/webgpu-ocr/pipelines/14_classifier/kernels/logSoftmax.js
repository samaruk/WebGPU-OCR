
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class LogSoftmaxKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./logSoftmax.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'logSoftmax', code);
  }
  run(enc, logitsBuf, logProbsBuf, S, nClass) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([S, nClass]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: logitsBuf  } },
        { binding: 1, resource: { buffer: logProbsBuf } },
        { binding: 2, resource: { buffer: params     } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'logSoftmax' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(S, 256));
    pass.end();
  }
}
