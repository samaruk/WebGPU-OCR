
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D, wgCount } from '../../../core/dispatch.js';

export class DeskewEstimationKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./deskewEstimation.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'deskewEstimation', code);
  }

  run(enc, inBuf, binsBuf, W, H, numAngles = 180, angleRange = 15.0) {
    const ab = new ArrayBuffer(16);
    new Uint32Array(ab).set([W, H, numAngles]);
    new Float32Array(ab, 12)[0] = angleRange;
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);

    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf   } },
        { binding: 1, resource: { buffer: binsBuf } },
        { binding: 2, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'deskewEstimation' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(numAngles, 256));
    pass.end();
  }
}
