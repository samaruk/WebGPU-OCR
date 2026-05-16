
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';

export class ReLUKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./relu.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'relu_bb', code);
  }

  run(enc, inBuf, outBuf, N) {
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'relu' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
