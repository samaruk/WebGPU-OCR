
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';

export class KeypointHeadKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./keypointHead.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'keypointHead', code);
  }

  run(enc, logitsBuf, heatmapBuf, W, H, cellSize = 8, thresh = 0.015) {
    const ab = new ArrayBuffer(16);
    new Uint32Array(ab).set([W, H, cellSize]);
    new Float32Array(ab, 12)[0] = thresh;
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: logitsBuf  } },
        { binding: 1, resource: { buffer: heatmapBuf } },
        { binding: 2, resource: { buffer: params      } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'keypointHead' });
    dispatch2D(pass, this.pipeline, bg, W / cellSize, H / cellSize);
    pass.end();
  }
}
