
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class SqueezeExcitationKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./squeezeExcitation.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'squeezeExcitation', code);
  }
  run(enc, inBuf, outBuf, w1Buf, w2Buf, C, reducedC, HW) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([C, reducedC, HW]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: w1Buf  } },
        { binding: 3, resource: { buffer: w2Buf  } },
        { binding: 4, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'squeezeExcitation' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(C, 256));
    pass.end();
  }
}
