// pipelines/pyramidPipeline.js
import { PipelineCache } from '../core/pipelineCache.js';
import { ceilDiv }       from '../core/barrierUtils.js';
import { Config }        from '../config.js';

export class PyramidPipeline {
  #gpu; #cache; #shaders = {};

  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    for (const n of ['gaussianPyramid','downsample','sigmaTracking']) {
      this.#shaders[n] = await loadShader(`pyramid/${n}.wgsl`);
    }
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`pyramid/${k}`, s);
  }

  /**
   * Build full Gaussian pyramid into bufs.levels[octave][scale].
   * @param {GPUCommandEncoder} enc
   * @param {object}            bufs — { levels, kernel, uniforms[] }
   */
  encodeOctave(enc, bufs, octave, W, H) {
    const d    = this.#gpu.device;
    const blurPL = this.#cache.get('pyramid/gaussianPyramid');
    for (let s = 1; s < Config.PYRAMID_SCALES + 3; s++) {
      const wgX = ceilDiv(W, Config.WG.DEFAULT_X);
      const wgY = ceilDiv(H, Config.WG.DEFAULT_Y);
      const bg = d.createBindGroup({
        layout: blurPL.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufs.uniforms[octave][s] } },
          { binding: 1, resource: { buffer: bufs.kernel } },
          { binding: 2, resource: { buffer: bufs.levels[octave][s-1] } },
          { binding: 3, resource: { buffer: bufs.levels[octave][s]   } },
        ],
      });
      const p = enc.beginComputePass({ label: `pyramid_o${octave}_s${s}` });
      p.setPipeline(blurPL); p.setBindGroup(0, bg);
      p.dispatchWorkgroups(wgX, wgY); p.end();
    }
  }
}
