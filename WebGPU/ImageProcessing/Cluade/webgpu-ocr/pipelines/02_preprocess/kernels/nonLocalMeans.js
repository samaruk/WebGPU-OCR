
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';

export class NonLocalMeansKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./nonLocalMeans.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'nonLocalMeans', code);
  }

  run(enc, inBuf, outBuf, W, H, searchWin = 21, patchSize = 7, h = 10.0) {
    const ab = new ArrayBuffer(20);
    new Uint32Array(ab).set([W, H, searchWin, patchSize]);
    new Float32Array(ab, 16)[0] = h / 255.0;
    const params = this.device.createBuffer({ size: 20, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);

    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'nonLocalMeans' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
