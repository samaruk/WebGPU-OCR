
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';

export class DescriptorSimilarityKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./descriptorSimilarity.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'descriptorSimilarity', code);
  }

  run(enc, descABuf, descBBuf, simBuf, N, M, D) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([N, M, D]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: descABuf } },
        { binding: 1, resource: { buffer: descBBuf } },
        { binding: 2, resource: { buffer: simBuf   } },
        { binding: 3, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'descriptorSimilarity' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 16), wgCount(M, 16));
    pass.end();
  }
}
