
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
export class TokenExpansionKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./tokenExpansion.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'tokenExpansion', code);
  }
  run(enc, rawBuf, outBuf, outLenBuf, inLen, blank = 0) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([inLen, blank]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rawBuf    } },
        { binding: 1, resource: { buffer: outBuf    } },
        { binding: 2, resource: { buffer: outLenBuf } },
        { binding: 3, resource: { buffer: params    } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'tokenExpansion' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1);
    pass.end();
  }
}
