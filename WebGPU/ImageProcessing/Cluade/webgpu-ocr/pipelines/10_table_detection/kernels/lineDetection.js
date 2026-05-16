
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';
export class LineDetectionKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./lineDetection.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'lineDetection', code);
  }
  run(enc, edgeBuf, linesBuf, W, H, minLen = 30, orient = 0) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, minLen, orient]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: edgeBuf  } },
        { binding: 1, resource: { buffer: linesBuf } },
        { binding: 2, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'lineDetection' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
