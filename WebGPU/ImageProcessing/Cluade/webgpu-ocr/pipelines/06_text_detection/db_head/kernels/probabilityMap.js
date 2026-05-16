
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';

export class ProbabilityMapKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./probabilityMap.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'probabilityMap', code);
  }

  run(enc, inBuf, probBuf, N) {
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf   } },
        { binding: 1, resource: { buffer: probBuf } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'probabilityMap' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
