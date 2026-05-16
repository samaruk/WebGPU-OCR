
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class FeatureFlattenKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./featureFlatten.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'featureFlatten', code);
  }
  run(enc, inBuf, outBuf, C, H, W) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([C, H, W]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'featureFlatten' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(W, 256), wgCount(C * H, 1));
    pass.end();
  }
}
