
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class GELUKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./gelu.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'gelu', code);
  }
  run(enc, xBuf, N) {
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: xBuf } }],
    });
    const pass = enc.beginComputePass({ label: 'gelu' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
