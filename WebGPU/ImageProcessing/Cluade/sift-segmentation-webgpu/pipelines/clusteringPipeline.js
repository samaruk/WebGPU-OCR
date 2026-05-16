// pipelines/clusteringPipeline.js
import { ceilDiv } from '../core/barrierUtils.js';
import { Config }  from '../config.js';

export class ClusteringPipeline {
  #gpu; #cache; #shaders = {};

  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    for (const n of ['spatialGridBuild','densityMap','descriptorSimilarity','regionLabelPropagation'])
      this.#shaders[n] = await loadShader(`clustering/${n}.wgsl`);
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`clustering/${k}`, s);
  }

  encodeCluster(enc, bufs, kpCount, W, H) {
    const d = this.#gpu.device;
    const wg = ceilDiv(kpCount, Config.WG.FLAT_256);

    const densityPL = this.#cache.get('clustering/densityMap');
    const dpBG = d.createBindGroup({
      layout: densityPL.getBindGroupLayout(0),
      entries: [
        { binding:0, resource:{buffer:bufs.densityUniform} },
        { binding:1, resource:{buffer:bufs.kps}             },
        { binding:2, resource:{buffer:bufs.density}         },
      ],
    });
    const dp = enc.beginComputePass({ label:'densityMap' });
    dp.setPipeline(densityPL); dp.setBindGroup(0, dpBG);
    dp.dispatchWorkgroups(wg); dp.end();

    // Propagation iterations
    const propPL = this.#cache.get('clustering/regionLabelPropagation');
    for (let i = 0; i < Config.CLUSTER_LABEL_ITERS; i++) {
      const propBG = d.createBindGroup({
        layout: propPL.getBindGroupLayout(0),
        entries: [
          { binding:0, resource:{buffer:bufs.propUniform}  },
          { binding:1, resource:{buffer:bufs.edges}         },
          { binding:2, resource:{buffer:bufs.kpLabels}      },
          { binding:3, resource:{buffer:bufs.propChanged}   },
        ],
      });
      const pp = enc.beginComputePass({ label:`propIter${i}` });
      pp.setPipeline(propPL); pp.setBindGroup(0, propBG);
      pp.dispatchWorkgroups(ceilDiv(bufs.edgeCount, Config.WG.FLAT_256)); pp.end();
    }
  }
}
