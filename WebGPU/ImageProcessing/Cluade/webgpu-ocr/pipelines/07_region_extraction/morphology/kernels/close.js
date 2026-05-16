
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { dispatch2D }         from '../../../../core/dispatch.js';
export class CloseKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./close.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'morphClose', code);
  }
  run(enc, inBuf, tmpBuf, outBuf, W, H, ks = 3) {
    const runP = (src, dst) => {
      const params = this.device.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.device.queue.writeBuffer(params, 0, new Uint32Array([W, H, ks]));
      const bg = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: src    } },
          { binding: 1, resource: { buffer: dst    } },
          { binding: 2, resource: { buffer: params } },
        ],
      });
      const pass = enc.beginComputePass({ label: 'morphClose' });
      dispatch2D(pass, this.pipeline, bg, W, H);
      pass.end();
    };
    runP(inBuf, tmpBuf);
    runP(tmpBuf, outBuf);
  }
}
