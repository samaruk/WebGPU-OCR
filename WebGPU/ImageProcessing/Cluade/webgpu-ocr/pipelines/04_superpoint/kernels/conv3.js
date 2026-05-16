
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D, wgCount } from '../../../core/dispatch.js';

export class Conv3Kernel {
  constructor(device) { this.device = device; this.name = 'conv3'; }

  async init() {
    const code = await loadShader(new URL('./conv3.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'conv3', code);
  }

  run(enc, inBuf, outBuf, wBuf, bBuf, inW, inH, outC, inC, kH = 3, kW = 3, stride = 1, pad = 1) {
    const ab = new ArrayBuffer(32);
    new Uint32Array(ab).set([inW, inH, outC, inC, kH, kW, stride, pad]);
    const params = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
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
    const outW = Math.floor(inW / stride);
    const outH = Math.floor(inH / stride);
    const pass = enc.beginComputePass({ label: 'conv3' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(outW, 8), wgCount(outH, 8), outC);
    pass.end();
  }
}
