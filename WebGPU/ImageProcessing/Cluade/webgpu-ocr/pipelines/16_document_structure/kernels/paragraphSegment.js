
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class ParagraphSegmentKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./paragraphSegment.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'paragraphSegment', code);
  }
  run(enc, bboxBuf, paraIdBuf, N, lineGap = 0.02) {
    const ab = new ArrayBuffer(8);
    new Uint32Array(ab)[0] = N;
    new Float32Array(ab, 4)[0] = lineGap;
    const params = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bboxBuf   } },
        { binding: 1, resource: { buffer: paraIdBuf } },
        { binding: 2, resource: { buffer: params    } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'paragraphSegment' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
