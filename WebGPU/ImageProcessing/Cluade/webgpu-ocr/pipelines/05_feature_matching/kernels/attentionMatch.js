
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';

export class AttentionMatchKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./attentionMatch.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'attentionMatch', code);
  }

  run(enc, qBuf, kBuf, scoresBuf, N, M, D, temperature = 0.1) {
    const ab = new ArrayBuffer(16);
    new Uint32Array(ab).set([N, M, D]);
    new Float32Array(ab, 12)[0] = temperature;
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: qBuf      } },
        { binding: 1, resource: { buffer: kBuf      } },
        { binding: 2, resource: { buffer: scoresBuf } },
        { binding: 3, resource: { buffer: params    } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'attentionMatch' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 16), wgCount(M, 16));
    pass.end();
  }
}
