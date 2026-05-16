// pipelines/segmentationPipeline.js
import { ceilDiv } from '../core/barrierUtils.js';
import { Config }  from '../config.js';

export class SegmentationPipeline {
  #gpu; #cache; #shaders = {};
  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    for (const n of ['binaryThreshold','localLabelInit','labelEquivalenceResolve',
                     'labelFlatten','relabelCompact','componentMetrics'])
      this.#shaders[n] = await loadShader(`segmentation/${n}.wgsl`);
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`segmentation/${k}`, s);
  }

  encode(enc, bufs, W, H) {
    const d       = this.#gpu.device;
    const pixels  = W * H;
    const wg256   = ceilDiv(pixels, Config.WG.FLAT_256);
    const wgXY    = [ceilDiv(W, Config.WG.DEFAULT_X), ceilDiv(H, Config.WG.DEFAULT_Y)];

    // 1. Threshold
    this.#runFlat(enc, d, 'binaryThreshold', bufs.threshBG, wg256);
    // 2. Init labels
    this.#runFlat(enc, d, 'localLabelInit', bufs.initBG, wg256);
    // 3. Iterative equivalence resolve
    for (let i=0; i<Config.SEG_LABEL_ITERS; i++)
      this.#run2D(enc, d, 'labelEquivalenceResolve', bufs.eqvBG, wgXY[0], wgXY[1]);
    // 4. Flatten
    this.#runFlat(enc, d, 'labelFlatten', bufs.flatBG, wg256);
    // 5. Compact relabelling
    this.#runFlat(enc, d, 'relabelCompact', bufs.relabelBG, wg256);
  }

  #runFlat(enc, d, key, bg, wg) {
    const pl = this.#cache.get(`segmentation/${key}`);
    const p  = enc.beginComputePass({ label: key });
    p.setPipeline(pl); p.setBindGroup(0, bg);
    p.dispatchWorkgroups(wg); p.end();
  }

  #run2D(enc, d, key, bg, wgX, wgY) {
    const pl = this.#cache.get(`segmentation/${key}`);
    const p  = enc.beginComputePass({ label: key });
    p.setPipeline(pl); p.setBindGroup(0, bg);
    p.dispatchWorkgroups(wgX, wgY); p.end();
  }
}
