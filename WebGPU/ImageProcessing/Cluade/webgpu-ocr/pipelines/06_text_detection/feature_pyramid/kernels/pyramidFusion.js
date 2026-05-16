
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../../core/dispatch.js';

export class PyramidFusionKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./pyramidFusion.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'pyramidFusion', code);
  }

  run(enc, p2, p3, p4, p5, fuseBuf, W, H, C) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, C]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: p2      } },
        { binding: 1, resource: { buffer: p3      } },
        { binding: 2, resource: { buffer: p4      } },
        { binding: 3, resource: { buffer: p5      } },
        { binding: 4, resource: { buffer: fuseBuf } },
        { binding: 5, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'pyramidFusion' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
