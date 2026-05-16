
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class EncBatchNormKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./batchNorm.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'encBatchNorm', code);
  }
  run(enc, inBuf, outBuf, gammaBuf, betaBuf, meanBuf, variBuf, W, H, C, eps = 1e-5) {
    const ab = new ArrayBuffer(16);
    new Uint32Array(ab).set([W,H,C]);
    new Float32Array(ab, 12)[0] = eps;
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf    } },
        { binding: 1, resource: { buffer: outBuf   } },
        { binding: 2, resource: { buffer: gammaBuf } },
        { binding: 3, resource: { buffer: betaBuf  } },
        { binding: 4, resource: { buffer: meanBuf  } },
        { binding: 5, resource: { buffer: variBuf  } },
        { binding: 6, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'encBatchNorm' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(W,8), wgCount(H,8), C);
    pass.end();
  }
}
