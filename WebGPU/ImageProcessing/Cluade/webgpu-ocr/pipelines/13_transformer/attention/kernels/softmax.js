
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class SoftmaxKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./softmax.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'softmax', code);
  }
  run(enc, xBuf, rows, cols) {
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([rows, cols]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: xBuf   } },
        { binding: 1, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'softmax' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(rows, 256));
    pass.end();
  }
}
