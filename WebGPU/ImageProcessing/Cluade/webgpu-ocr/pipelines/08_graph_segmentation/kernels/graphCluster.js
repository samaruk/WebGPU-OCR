
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { wgCount }            from '../../../core/dispatch.js';
export class GraphClusterKernel {
  constructor(device) { this.device = device; }
  async init() {
    const code = await loadShader(new URL('./graphCluster.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'graphCluster', code);
  }
  run(enc, nodeFBuf, clusterBuf, centroidBuf, N, D, K, thresh = 0.1) {
    const ab = new ArrayBuffer(16);
    new Uint32Array(ab).set([N, D, K]);
    new Float32Array(ab, 12)[0] = thresh;
    const params = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(params, 0, ab);
    const bg = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: nodeFBuf    } },
        { binding: 1, resource: { buffer: clusterBuf  } },
        { binding: 2, resource: { buffer: centroidBuf } },
        { binding: 3, resource: { buffer: params      } },
      ],
    });
    const pass = enc.beginComputePass({ label: 'graphCluster' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount(N, 256));
    pass.end();
  }
}
