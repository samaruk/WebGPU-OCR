
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class PrefixBeamSearchKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./prefixBeamSearch.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'prefixBeamSearch', code);
  }
  run(enc, logProbsBuf, beamTokensBuf, beamScoresBuf, newTokensBuf, newScoresBuf, S, nClass, beamWidth, blank = 0) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([S, nClass, beamWidth, blank]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: logProbsBuf    } },
        { binding: 1, resource: { buffer: beamTokensBuf  } },
        { binding: 2, resource: { buffer: beamScoresBuf  } },
        { binding: 3, resource: { buffer: newTokensBuf   } },
        { binding: 4, resource: { buffer: newScoresBuf   } },
        { binding: 5, resource: { buffer: params         } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'prefixBeamSearch' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(beamWidth, 256));
    pass.end();
  }
}
