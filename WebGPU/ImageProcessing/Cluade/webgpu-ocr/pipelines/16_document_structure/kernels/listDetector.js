
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class ListDetectorKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./listDetector.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'listDetector', code);
  }
  run(enc, bboxBuf, isListBuf, N, indent = 0.05) {
    const ab = new ArrayBuffer(8);
    new Uint32Array(ab)[0] = N;
    new Float32Array(ab, 4)[0] = indent;
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bboxBuf  } },
        { binding: 1, resource: { buffer: isListBuf } },
        { binding: 2, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'listDetector' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
