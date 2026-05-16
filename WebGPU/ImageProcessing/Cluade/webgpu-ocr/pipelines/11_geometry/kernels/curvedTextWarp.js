
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';
export class CurvedTextWarpKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./curvedTextWarp.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'curvedTextWarp', code);
  }
  run(enc, srcBuf, dstBuf, ctrlSrcBuf, ctrlDstBuf, srcW, srcH, dstW, dstH, numCtrl) {
    const ab = new ArrayBuffer(20);
    new Uint32Array(ab).set([srcW, srcH, dstW, dstH, numCtrl]);
    const params = this.device.createBuffer({ size: 20, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcBuf     } },
        { binding: 1, resource: { buffer: dstBuf     } },
        { binding: 2, resource: { buffer: ctrlSrcBuf } },
        { binding: 3, resource: { buffer: ctrlDstBuf } },
        { binding: 4, resource: { buffer: params     } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'curvedTextWarp' });
    dispatch2D(pass, this.pipeline, bg, dstW, dstH);
    pass.end();
  }
}
