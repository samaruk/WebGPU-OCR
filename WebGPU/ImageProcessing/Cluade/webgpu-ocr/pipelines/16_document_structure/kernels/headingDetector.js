
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class HeadingDetectorKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./headingDetector.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'headingDetector', code);
  }
  run(enc, blockMetaBuf, isHeadingBuf, N, avgFontSize = 12, headingRatio = 1.4) {
    const ab = new ArrayBuffer(12);
    new Uint32Array(ab)[0] = N;
    new Float32Array(ab, 4).set([avgFontSize, headingRatio]);
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: blockMetaBuf  } },
        { binding: 1, resource: { buffer: isHeadingBuf  } },
        { binding: 2, resource: { buffer: params        } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'headingDetector' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
