
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class LogitsLinearKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./logitsLinear.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'logitsLinear', code);
  }
  run(enc, xBuf, WBuf, bBuf, logitsBuf, S, dModel, nClass) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([S, dModel, nClass]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: xBuf      } },
        { binding: 1, resource: { buffer: WBuf      } },
        { binding: 2, resource: { buffer: bBuf      } },
        { binding: 3, resource: { buffer: logitsBuf } },
        { binding: 4, resource: { buffer: params    } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'logitsLinear' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(S, 256), wgCount(nClass, 1));
    pass.end();
  }
}
