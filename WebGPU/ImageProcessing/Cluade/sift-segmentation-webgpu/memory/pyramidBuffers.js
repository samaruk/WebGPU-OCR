// memory/pyramidBuffers.js — Allocate pyramid level buffers
import { Config } from '../config.js';

const U = GPUBufferUsage;

export class PyramidBuffers {
  levels   = [];  // [octave][scale] = GPUBuffer (f32 array)
  dogLevels= [];  // [octave][dog_layer]
  kernel   = null;
  sigmaTable = null;

  constructor(device, W, H) {
    this.device = device;
    this._W = W; this._H = H;
    this._allocate();
  }

  _allocate() {
    const d = this.device;
    const oct = Config.PYRAMID_OCTAVES;
    const scl = Config.PYRAMID_SCALES + 3;

    for (let o = 0; o < oct; o++) {
      const ow = this._W >> o;
      const oh = this._H >> o;
      const bytes = ow * oh * 4;
      this.levels[o]    = [];
      this.dogLevels[o] = [];
      for (let s = 0; s < scl; s++) {
        this.levels[o][s] = d.createBuffer({
          label: `pyr_o${o}_s${s}`,
          size: Math.max(bytes, 4),
          usage: U.STORAGE | U.COPY_SRC | U.COPY_DST,
        });
      }
      for (let s = 0; s < scl - 1; s++) {
        this.dogLevels[o][s] = d.createBuffer({
          label: `dog_o${o}_s${s}`,
          size: Math.max(bytes, 4),
          usage: U.STORAGE | U.COPY_SRC | U.COPY_DST,
        });
      }
    }

    const radius = Math.ceil(Config.GAUSSIAN_KERNEL_SIZE / 2);
    const kLen   = radius * 2 + 1;
    this.kernel = d.createBuffer({
      label: 'gaussKernel',
      size: kLen * 4,
      usage: U.STORAGE | U.COPY_DST,
    });

    this.sigmaTable = d.createBuffer({
      label: 'sigmaTable',
      size: oct * scl * 4,
      usage: U.STORAGE | U.COPY_DST,
    });
  }

  /** Upload 1-D Gaussian kernel from CPU. */
  uploadKernel(queue, sigma) {
    const radius = Math.ceil(Config.GAUSSIAN_KERNEL_SIZE / 2);
    const len = radius * 2 + 1;
    const data = new Float32Array(len);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const x = i - radius;
      data[i] = Math.exp(-x*x / (2*sigma*sigma));
      sum += data[i];
    }
    for (let i = 0; i < len; i++) data[i] /= sum;
    queue.writeBuffer(this.kernel, 0, data);
  }

  destroy() {
    for (const oct of this.levels) for (const b of oct) b.destroy();
    for (const oct of this.dogLevels) for (const b of oct) b.destroy();
    this.kernel?.destroy();
    this.sigmaTable?.destroy();
  }
}
