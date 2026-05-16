
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';
export class GraphFeaturesKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./graphFeatures.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'graphFeatures', code);
  }
  run(enc, featBuf, labelBuf, nodeFBuf, nodeCntBuf, W, H, C, numNodes) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, C, numNodes]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: featBuf    } },
        { binding: 1, resource: { buffer: labelBuf   } },
        { binding: 2, resource: { buffer: nodeFBuf   } },
        { binding: 3, resource: { buffer: nodeCntBuf } },
        { binding: 4, resource: { buffer: params     } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'graphFeatures' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
