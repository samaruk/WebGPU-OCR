// pipelines/preprocessPipeline.js
import { PipelineCache } from '../core/pipelineCache.js';
import { ceilDiv }       from '../core/barrierUtils.js';
import { Config }        from '../config.js';

export class PreprocessPipeline {
  #gpu; #cache; #shaders = {};

  constructor(gpuContext, pipelineCache) {
    this.#gpu   = gpuContext;
    this.#cache = pipelineCache;
  }

  async loadShaders(loadShader) {
    const names = ['rgbToGray','claheHistogram','claheRedistribute',
                   'gammaCorrection','gaussianBlurHorizontal','gaussianBlurVertical','bilateralFilter'];
    for (const n of names) {
      this.#shaders[n] = await loadShader(`preprocess/${n}.wgsl`);
    }
  }

  async init() {
    for (const [k, src] of Object.entries(this.#shaders)) {
      await this.#cache.get(`preprocess/${k}`, src);
    }
  }

  /**
   * Run full preprocessing chain.
   * @param {GPUCommandEncoder} enc
   * @param {GPUTexture}        srcTex   — rgba8unorm input
   * @param {object}            bufs     — { gray, temp, claheHists, claheCdfs, kernel }
   * @param {number}            W
   * @param {number}            H
   */
  encode(enc, srcTex, bufs, W, H) {
    const d = this.#gpu.device;
    const wgX = ceilDiv(W, Config.WG.DEFAULT_X);
    const wgY = ceilDiv(H, Config.WG.DEFAULT_Y);

    // 1. RGB → Gray
    const grayPL  = this.#cache.get('preprocess/rgbToGray');
    const grayBG  = d.createBindGroup({
      layout: (grayPL instanceof Promise ? null : grayPL).getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufs.uniform } },
        { binding: 1, resource: srcTex.createView() },
        { binding: 2, resource: bufs.gray.createView() },
      ],
    });
    const p1 = enc.beginComputePass({ label: 'rgbToGray' });
    p1.setPipeline(grayPL); p1.setBindGroup(0, grayBG);
    p1.dispatchWorkgroups(wgX, wgY); p1.end();

    // 2. Bilateral filter
    const bilPL = this.#cache.get('preprocess/bilateralFilter');
    const bilBG = d.createBindGroup({
      layout: bilPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufs.bilUniform } },
        { binding: 1, resource: bufs.gray.createView() },
        { binding: 2, resource: bufs.temp.createView() },
      ],
    });
    const p2 = enc.beginComputePass({ label: 'bilateral' });
    p2.setPipeline(bilPL); p2.setBindGroup(0, bilBG);
    p2.dispatchWorkgroups(wgX, wgY); p2.end();
  }
}
