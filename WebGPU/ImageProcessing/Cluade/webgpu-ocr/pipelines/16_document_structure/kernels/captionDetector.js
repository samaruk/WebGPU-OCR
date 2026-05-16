
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class CaptionDetectorKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./captionDetector.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'captionDetector', code);
  }
  run(enc, bboxBuf, isCaptionBuf, N, maxH = 0.04) {
    const ab = new ArrayBuffer(8);
    new Uint32Array(ab)[0] = N;
    new Float32Array(ab, 4)[0] = maxH;
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bboxBuf      } },
        { binding: 1, resource: { buffer: isCaptionBuf } },
        { binding: 2, resource: { buffer: params       } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'captionDetector' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
