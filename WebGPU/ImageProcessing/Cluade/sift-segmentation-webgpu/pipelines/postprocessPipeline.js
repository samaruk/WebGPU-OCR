// pipelines/postprocessPipeline.js
import { ceilDiv } from '../core/barrierUtils.js';
import { Config }  from '../config.js';

export class PostprocessPipeline {
  #gpu; #cache; #shaders = {};
  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    for (const n of ['boundingBoxReduce','aspectRatioFilter','polygonApprox','finalMaskWrite'])
      this.#shaders[n] = await loadShader(`postprocess/${n}.wgsl`);
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`postprocess/${k}`, s);
  }

  encode(enc, bufs, W, H, numLabels) {
    const d   = this.#gpu.device;
    const wgP = ceilDiv(W * H, Config.WG.FLAT_256);
    const wgL = ceilDiv(numLabels, Config.WG.FLAT_256);
    const wgXY= [ceilDiv(W,8), ceilDiv(H,8)];

    const bbPL   = this.#cache.get('postprocess/boundingBoxReduce');
    const arPL   = this.#cache.get('postprocess/aspectRatioFilter');
    const polyPL = this.#cache.get('postprocess/polygonApprox');
    const fmPL   = this.#cache.get('postprocess/finalMaskWrite');

    for (const [pl, bg, x, y=1] of [
      [bbPL,   bufs.bbBG,   wgP],
      [arPL,   bufs.arBG,   wgL],
      [polyPL, bufs.polyBG, wgL],
      [fmPL,   bufs.fmBG,   wgXY[0], wgXY[1]],
    ]) {
      const p = enc.beginComputePass({ label: pl.label });
      p.setPipeline(pl); p.setBindGroup(0, bg);
      p.dispatchWorkgroups(x, y); p.end();
    }
  }
}
