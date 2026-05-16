
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';

export class MultiScaleMergeKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./multiScaleMerge.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'multiScaleMerge', code);
  }

  run(enc, inputsBuf, outBuf, N, size) {
    const params = this.device.createBuffer({ size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([N]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputsBuf } },
        { binding: 1, resource: { buffer: outBuf    } },
        { binding: 2, resource: { buffer: params    } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'multiScaleMerge' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(size, 256));
    pass.end();
  }
}
