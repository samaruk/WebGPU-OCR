
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../core/dispatch.js';
export class AdjacencyGraphKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./adjacencyGraph.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'adjacencyGraph', code);
  }
  run(enc, labelBuf, adjBuf, W, H, numLabels) {
    const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, numLabels]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: labelBuf } },
        { binding: 1, resource: { buffer: adjBuf   } },
        { binding: 2, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'adjacencyGraph' });
    dispatch2D(pass, this.pipeline, bg, W, H);
    pass.end();
  }
}
