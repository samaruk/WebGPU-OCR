
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';

export class BinarizationKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./binarization.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'binarization', code);
  }

  run(enc, probBuf, thrBuf, binBuf, N, k = 50.0) {
    const params = this.device.createBuffer({ size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Float32Array([k]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: probBuf } },
        { binding: 1, resource: { buffer: thrBuf  } },
        { binding: 2, resource: { buffer: binBuf  } },
        { binding: 3, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'binarization' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
