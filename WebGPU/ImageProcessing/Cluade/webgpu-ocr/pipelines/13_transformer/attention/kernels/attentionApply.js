
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class AttentionApplyKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./attentionApply.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'attentionApply', code);
  }
  run(enc, attnWBuf, VBuf, WoBuf, outBuf, S, dHead, nHead, dModel) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([S, dHead, nHead, dModel]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: attnWBuf } },
        { binding: 1, resource: { buffer: VBuf     } },
        { binding: 2, resource: { buffer: WoBuf    } },
        { binding: 3, resource: { buffer: outBuf   } },
        { binding: 4, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'attentionApply' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(S, 256), wgCount(dModel, 1));
    pass.end();
  }
}
