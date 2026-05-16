
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class AttentionScoresKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./attentionScores.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'attentionScores', code);
  }
  run(enc, QBuf, KBuf, scoresBuf, S, dHead, nHead) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([S, dHead, nHead]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: QBuf      } },
        { binding: 1, resource: { buffer: KBuf      } },
        { binding: 2, resource: { buffer: scoresBuf } },
        { binding: 3, resource: { buffer: params    } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'attentionScores' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(S,8), wgCount(S,8), nHead);
    pass.end();
  }
}
