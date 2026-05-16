
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';
export class PerspectiveWarpKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./perspectiveWarp.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'perspectiveWarp', code);
  }
  run(enc, srcBuf, dstBuf, HinvBuf, srcW, srcH, dstW, dstH) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([srcW, srcH, dstW, dstH]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcBuf  } },
        { binding: 1, resource: { buffer: dstBuf  } },
        { binding: 2, resource: { buffer: HinvBuf } },
        { binding: 3, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'perspectiveWarp' });
    dispatch2D(pass, this.pipeline, bg, dstW, dstH);
    pass.end();
  }
}
