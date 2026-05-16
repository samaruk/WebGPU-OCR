
import { loadShader }         from '../../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../../core/pipelineCache.js';
import { wgCount }            from '../../../../core/dispatch.js';
export class QKVProjectionKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./qkvProjection.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'qkvProjection', code);
  }
  run(enc, xBuf, WqBuf, WkBuf, WvBuf, QBuf, KBuf, VBuf, S, dModel, dHead, nHead) {
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, new Uint32Array([S, dModel, dHead, nHead]));
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: xBuf    } },
        { binding: 1, resource: { buffer: WqBuf   } },
        { binding: 2, resource: { buffer: WkBuf   } },
        { binding: 3, resource: { buffer: WvBuf   } },
        { binding: 4, resource: { buffer: QBuf    } },
        { binding: 5, resource: { buffer: KBuf    } },
        { binding: 6, resource: { buffer: VBuf    } },
        { binding: 7, resource: { buffer: params  } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'qkvProjection' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(S, 256), wgCount(nHead*dHead, 1));
    pass.end();
  }
}
