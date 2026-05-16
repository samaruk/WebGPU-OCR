
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class FFLinear2Kernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./linear2.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'ffLinear2', code);
  }
  run(enc, xBuf, WBuf, bBuf, outBuf, S, inD, outD) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([S, inD, outD]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: xBuf   } },
        { binding: 1, resource: { buffer: WBuf   } },
        { binding: 2, resource: { buffer: bBuf   } },
        { binding: 3, resource: { buffer: outBuf } },
        { binding: 4, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'ffLinear2' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(S, 256), wgCount(outD, 1));
    pass.end();
  }
}
