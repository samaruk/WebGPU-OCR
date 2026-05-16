// pipelines/siftPipeline.js
import { ceilDiv } from '../core/barrierUtils.js';
import { Config }  from '../config.js';

export class SiftPipeline {
  #gpu; #cache; #shaders = {};

  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    const names = ['dog','extrema3D','contrastReject','hessianReject',
                   'subpixelRefine','gradientMap','orientationAssign',
                   'descriptorHistogram','descriptorNormalize','keypointCompaction'];
    for (const n of names) this.#shaders[n] = await loadShader(`sift/${n}.wgsl`);
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`sift/${k}`, s);
  }

  /**
   * Encode the full SIFT detection pass for one (octave, scale) triplet.
   * @param {GPUCommandEncoder} enc
   * @param {object} bufs  — all SIFT GPU buffers
   * @param {number} W, H  — current octave dimensions
   */
  encodeDetection(enc, bufs, W, H) {
    const d   = this.#gpu.device;
    const wg  = ceilDiv(W * H, Config.WG.FLAT_256);

    const runPass = (label, pl, bg, x, y=1, z=1) => {
      const p = enc.beginComputePass({ label });
      p.setPipeline(pl); p.setBindGroup(0, bg);
      p.dispatchWorkgroups(x, y, z); p.end();
    };

    // DoG
    const dogPL = this.#cache.get('sift/dog');
    runPass('dog', dogPL, d.createBindGroup({
      layout: dogPL.getBindGroupLayout(0),
      entries: [
        { binding:0, resource:{buffer:bufs.dogUniform} },
        { binding:1, resource:{buffer:bufs.blurUpper}  },
        { binding:2, resource:{buffer:bufs.blurLower}  },
        { binding:3, resource:{buffer:bufs.dog}        },
      ],
    }), ceilDiv(W, 8), ceilDiv(H, 8));

    // Extrema3D
    const extPL = this.#cache.get('sift/extrema3D');
    runPass('extrema', extPL, d.createBindGroup({
      layout: extPL.getBindGroupLayout(0),
      entries: [
        { binding:0, resource:{buffer:bufs.extUniform} },
        { binding:1, resource:{buffer:bufs.dogPrev}    },
        { binding:2, resource:{buffer:bufs.dog}        },
        { binding:3, resource:{buffer:bufs.dogNext}    },
        { binding:4, resource:{buffer:bufs.kpCounter}  },
        { binding:5, resource:{buffer:bufs.kpXY}       },
      ],
    }), ceilDiv(W, 8), ceilDiv(H, 8));
  }
}
