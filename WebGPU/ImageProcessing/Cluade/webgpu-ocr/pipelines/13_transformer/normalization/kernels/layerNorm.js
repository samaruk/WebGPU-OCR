
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class LayerNormKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./layerNorm.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'layerNorm', code);
  }
  run(enc, xBuf, gammaBuf, betaBuf, S, dModel, eps = 1e-5) {
    const ab = new ArrayBuffer(12);
    new Uint32Array(ab).set([S, dModel]);
    new Float32Array(ab, 8)[0] = eps;
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: xBuf     } },
        { binding: 1, resource: { buffer: gammaBuf } },
        { binding: 2, resource: { buffer: betaBuf  } },
        { binding: 3, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'layerNorm' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(S, 256));
    pass.end();
  }
}
