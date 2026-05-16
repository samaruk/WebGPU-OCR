
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class CellExtractionKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./cellExtraction.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'cellExtraction', code);
  }
  run(enc, inBuf, rowsBuf, colsBuf, cellsBuf, W, H, numRows, numCols) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, numRows, numCols]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf    } },
        { binding: 1, resource: { buffer: rowsBuf  } },
        { binding: 2, resource: { buffer: colsBuf  } },
        { binding: 3, resource: { buffer: cellsBuf } },
        { binding: 4, resource: { buffer: params   } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'cellExtraction' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(numCols-1, 8), wgCount(numRows-1, 8));
    pass.end();
  }
}
