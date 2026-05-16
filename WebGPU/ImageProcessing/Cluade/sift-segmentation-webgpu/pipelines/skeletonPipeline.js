// pipelines/skeletonPipeline.js
import { ceilDiv } from '../core/barrierUtils.js';
import { Config }  from '../config.js';

export class SkeletonPipeline {
  #gpu; #cache; #shaders = {};
  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    for (const n of ['thinningPassA','thinningPassB','endpointDetect','branchDetect'])
      this.#shaders[n] = await loadShader(`skeleton/${n}.wgsl`);
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`skeleton/${k}`, s);
  }

  encode(enc, bufs, W, H) {
    const d   = this.#gpu.device;
    const wgX = ceilDiv(W, Config.WG.DEFAULT_X);
    const wgY = ceilDiv(H, Config.WG.DEFAULT_Y);

    const passA = this.#cache.get('skeleton/thinningPassA');
    const passB = this.#cache.get('skeleton/thinningPassB');

    for (let i = 0; i < Config.SKEL_MAX_ITERS; i++) {
      // Sub-iter A
      const pa = enc.beginComputePass({ label:`skelA_${i}` });
      pa.setPipeline(passA); pa.setBindGroup(0, bufs.passABG);
      pa.dispatchWorkgroups(wgX, wgY); pa.end();
      // Delete
      const pb = enc.beginComputePass({ label:`skelB_${i}` });
      pb.setPipeline(passB); pb.setBindGroup(0, bufs.passBBG);
      pb.dispatchWorkgroups(wgX, wgY); pb.end();
    }

    const epPL = this.#cache.get('skeleton/endpointDetect');
    const ep   = enc.beginComputePass({ label:'endpoints' });
    ep.setPipeline(epPL); ep.setBindGroup(0, bufs.epBG);
    ep.dispatchWorkgroups(wgX, wgY); ep.end();

    const brPL = this.#cache.get('skeleton/branchDetect');
    const br   = enc.beginComputePass({ label:'branches' });
    br.setPipeline(brPL); br.setBindGroup(0, bufs.brBG);
    br.dispatchWorkgroups(wgX, wgY); br.end();
  }
}
