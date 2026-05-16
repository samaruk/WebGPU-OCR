// pipelines/graphPipeline.js
import { ceilDiv } from '../core/barrierUtils.js';
import { Config }  from '../config.js';

export class GraphPipeline {
  #gpu; #cache; #shaders = {};
  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    for (const n of ['adjacencyBuild','mergeScoreCompute','splitScoreCompute',
                     'deterministicMerge','labelUpdate'])
      this.#shaders[n] = await loadShader(`graph/${n}.wgsl`);
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`graph/${k}`, s);
  }

  encode(enc, bufs, W, H, edgeCount) {
    const d   = this.#gpu.device;
    const wg2 = [ceilDiv(W, Config.WG.DEFAULT_X), ceilDiv(H, Config.WG.DEFAULT_Y)];
    const wgE = ceilDiv(edgeCount, Config.WG.FLAT_256);

    // Build adjacency
    const adjPL = this.#cache.get('graph/adjacencyBuild');
    const ap = enc.beginComputePass({ label:'adjBuild' });
    ap.setPipeline(adjPL); ap.setBindGroup(0, bufs.adjBG);
    ap.dispatchWorkgroups(wg2[0], wg2[1]); ap.end();

    // Score edges
    const msPL = this.#cache.get('graph/mergeScoreCompute');
    const mp = enc.beginComputePass({ label:'mergeScore' });
    mp.setPipeline(msPL); mp.setBindGroup(0, bufs.mergeBG);
    mp.dispatchWorkgroups(wgE); mp.end();

    // Merge passes
    const dmPL = this.#cache.get('graph/deterministicMerge');
    for (let i=0; i<Config.GRAPH_MAX_ITERS; i++) {
      const dp = enc.beginComputePass({ label:`merge_${i}` });
      dp.setPipeline(dmPL); dp.setBindGroup(0, bufs.dmBG);
      dp.dispatchWorkgroups(wgE); dp.end();
    }

    // Update pixel labels
    const luPL = this.#cache.get('graph/labelUpdate');
    const lp = enc.beginComputePass({ label:'labelUpdate' });
    lp.setPipeline(luPL); lp.setBindGroup(0, bufs.luBG);
    lp.dispatchWorkgroups(ceilDiv(W*H, Config.WG.FLAT_256)); lp.end();
  }
}
