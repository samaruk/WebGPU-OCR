
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class RelativePositionEncodingKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./relativePositionEncoding.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'relativePositionEncoding', code);
  }
  run(enc, relPEBuf, seqLen, dModel, maxDist = 64) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([seqLen, dModel, maxDist]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: relPEBuf } },
        { binding: 1, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'relPE' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(2*maxDist+1, 256), wgCount(dModel, 1));
    pass.end();
  }
}
