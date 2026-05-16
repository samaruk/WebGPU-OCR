
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class ResidualAddKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./residualAdd.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'residualAdd', code);
  }
  run(enc, aBuf, bBuf, outBuf, N) {
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: aBuf   } },
        { binding: 1, resource: { buffer: bBuf   } },
        { binding: 2, resource: { buffer: outBuf } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'residualAdd' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
