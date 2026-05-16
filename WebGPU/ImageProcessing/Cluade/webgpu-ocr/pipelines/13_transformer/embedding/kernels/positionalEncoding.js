
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class PositionalEncodingKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./positionalEncoding.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'positionalEncoding', code);
  }
  run(enc, peBuf, seqLen, dModel) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([seqLen, dModel]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: peBuf   } },
        { binding: 1, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'positionalEncoding' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(seqLen, 256), wgCount(dModel, 1));
    pass.end();
  }
}
