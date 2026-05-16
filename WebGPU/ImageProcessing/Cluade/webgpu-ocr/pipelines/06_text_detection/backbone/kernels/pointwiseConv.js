
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';

export class PointwiseConvKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./pointwiseConv.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'pointwiseConv', code);
  }

  run(enc, inBuf, outBuf, wBuf, bBuf, W, H, inC, outC) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, inC, outC]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: wBuf   } },
        { binding: 3, resource: { buffer: bBuf   } },
        { binding: 4, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'pointwiseConv' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(W, 8), wgCount(H, 8), outC);
    pass.end();
  }
}
