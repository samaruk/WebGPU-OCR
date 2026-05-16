
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';

export class DeskewRotateKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./deskewRotate.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'deskewRotate', code);
  }

  run(enc, inBuf, outBuf, W, H, angleDeg) {
    const ab = new ArrayBuffer(12);
    new Uint32Array(ab).set([W, H]);
    new Float32Array(ab, 8)[0] = angleDeg;
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);

    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf  } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'deskewRotate' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
