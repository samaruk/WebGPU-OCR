
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';

export class CornerDetectorKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./cornerDetector.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'cornerDetector', code);
  }

  run(enc, gxBuf, gyBuf, respBuf, W, H, k = 0.04, thresh = 0.01) {
    const ab = new ArrayBuffer(16);
    new Uint32Array(ab).set([W, H]);
    new Float32Array(ab, 8).set([k, thresh]);
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gxBuf   } },
        { binding: 1, resource: { buffer: gyBuf   } },
        { binding: 2, resource: { buffer: respBuf } },
        { binding: 3, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'cornerDetector' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
