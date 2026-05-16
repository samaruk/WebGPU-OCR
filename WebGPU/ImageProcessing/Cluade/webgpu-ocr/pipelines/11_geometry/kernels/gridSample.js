
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';
export class GridSampleKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./gridSample.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'gridSample', code);
  }
  run(enc, srcBuf, gridBuf, dstBuf, srcW, srcH, dstW, dstH, C) {
    const params = this.device.createBuffer({ size: 20, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([srcW, srcH, dstW, dstH, C]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcBuf  } },
        { binding: 1, resource: { buffer: gridBuf } },
        { binding: 2, resource: { buffer: dstBuf  } },
        { binding: 3, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'gridSample' });
    dispatch2D(pass, this.pipeline, bg, dstW, dstH);
    pass.end();
  }
}
