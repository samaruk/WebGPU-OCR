
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';

export class UpsampleKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./upsample.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'fpnUpsample', code);
  }

  run(enc, inBuf, outBuf, srcW, srcH, dstW, dstH, C) {
    const params = this.device.createBuffer({ size: 20, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([srcW, srcH, dstW, dstH, C]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'fpnUpsample' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(dstW, 8), wgCount(dstH, 8), C);
    pass.end();
  }
}
