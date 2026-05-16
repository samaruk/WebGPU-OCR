
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';

export class MatchFilteringKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./matchFiltering.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'matchFiltering', code);
  }

  run(enc, simBuf, matchesBuf, N, M, ratioThresh = 0.75) {
    const ab = new ArrayBuffer(12);
    new Uint32Array(ab).set([N, M]);
    new Float32Array(ab, 8)[0] = ratioThresh;
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: simBuf     } },
        { binding: 1, resource: { buffer: matchesBuf } },
        { binding: 2, resource: { buffer: params     } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'matchFiltering' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
