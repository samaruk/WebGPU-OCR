
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';

export class ThresholdMapKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./thresholdMap.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'thresholdMap', code);
  }

  run(enc, inBuf, thrBuf, N) {
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: thrBuf } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'thresholdMap' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
