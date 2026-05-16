
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';

export class DepthwiseConvKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./depthwiseConv.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'depthwiseConv', code);
  }

  run(enc, inBuf, outBuf, wBuf, W, H, C, kH = 3, kW = 3, stride = 1, pad = 1) {
    const ab = new ArrayBuffer(28);
    new Uint32Array(ab).set([W, H, C, kH, kW, stride, pad]);
    const params = this.device.createBuffer({ size: 28, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: wBuf   } },
        { binding: 3, resource: { buffer: params } },
      ],
    });
    const oW = Math.floor(W / stride);
    const oH = Math.floor(H / stride);
    const pass = enc.beginComputePass({ label: 'depthwiseConv' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(oW, 8), wgCount(oH, 8), C);
    pass.end();
  }
}
