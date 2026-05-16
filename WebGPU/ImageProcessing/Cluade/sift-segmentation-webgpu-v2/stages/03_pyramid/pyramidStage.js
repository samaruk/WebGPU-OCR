// pyramidStage.js — build full Gaussian + DoG pyramid
import { makeGaussianLevelPipeline } from './gaussianLevel.js';
import { makeDownsamplePipeline }    from './downsample.js';
import { gaussianKernel1D, ceilDiv } from '../00_common/math.js';
import { blitBufferToCanvas }        from '../../core/dispatch.js';
import { Config }                    from '../../config.js';

export class PyramidStage {
  #pyrPL; #dsPL; #device; #queue;
  constructor(device, queue) { this.#device = device; this.#queue = queue; }

  async init(loadShader) {
    [this.#pyrPL, this.#dsPL] = await Promise.all([
      makeGaussianLevelPipeline(this.#device, loadShader),
      makeDownsamplePipeline(this.#device, loadShader),
    ]);
  }

  encode(enc, mem) {
    const d = this.#device;
    const q = this.#queue;
    const U = GPUBufferUsage;
    const oct = Config.OCTAVES;
    const scl = Config.SCALES + 3;   // levels per octave

    /** Create a small UNIFORM buffer from a typed array. */
    const mkUni = (arr) => {
      const b = d.createBuffer({
        size: Math.max(arr.byteLength, 16),
        usage: U.UNIFORM | U.COPY_DST,
      });
      q.writeBuffer(b, 0, arr);
      return b;
    };

    // ── seed octave-0, level-0 from the pre-blurred buffer ──────────────────
    enc.copyBufferToBuffer(mem.blurBuf, 0, mem.pyrLevels[0][0], 0, mem.W * mem.H * 4);

    for (let o = 0; o < oct; o++) {
      const ow = mem.W >> o;
      const oh = mem.H >> o;

      // ── downsample from previous octave's base level ─────────────────────
      if (o > 0) {
        const pw  = mem.W >> (o - 1);
        const ph  = mem.H >> (o - 1);
        const dsu = mkUni(new Uint32Array([pw, ph, ow, oh]));
        const dsBG = d.createBindGroup({
          layout: this.#dsPL.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: dsu } },
            { binding: 1, resource: { buffer: mem.pyrLevels[o - 1][Config.SCALES] } },
            { binding: 2, resource: { buffer: mem.pyrLevels[o][0] } },
          ],
        });
        const dp = enc.beginComputePass({ label: `ds_${o}` });
        dp.setPipeline(this.#dsPL);
        dp.setBindGroup(0, dsBG);
        dp.dispatchWorkgroups(ceilDiv(ow, 8), ceilDiv(oh, 8));
        dp.end();
      }

      // ── blur each successive level within this octave ────────────────────
      for (let s = 1; s < scl; s++) {
        const sigma  = Config.SIGMA_BASE * Math.pow(Config.K, s) * Math.pow(2, o);
        const radius = Math.min(Math.ceil(sigma * 3), 15);
        const kern   = gaussianKernel1D(sigma, radius);

        const kbuf = d.createBuffer({
          size: Math.max(kern.byteLength, 16),
          usage: U.STORAGE | U.COPY_DST,
        });
        q.writeBuffer(kbuf, 0, kern);

        // Uniform layout: src_w, src_h, dst_w, dst_h, radius, _p0, _p1, _p2
        const pyrUni = mkUni(new Uint32Array([ow, oh, ow, oh, radius, 0, 0, 0]));

        // ── 4 bindings: uniform · kernel · src · dst ─────────────────────
        const bg = d.createBindGroup({
          layout: this.#pyrPL.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: pyrUni } },
            { binding: 1, resource: { buffer: kbuf } },
            { binding: 2, resource: { buffer: mem.pyrLevels[o][s - 1] } },
            { binding: 3, resource: { buffer: mem.pyrLevels[o][s] } },   // dst only
          ],
        });

        const pp = enc.beginComputePass({ label: `pyr_${o}_${s}` });
        pp.setPipeline(this.#pyrPL);
        pp.setBindGroup(0, bg);
        pp.dispatchWorkgroups(ceilDiv(ow, 8), ceilDiv(oh, 8));
        pp.end();
      }
    }
  }

  visualize(mem, canvas, octave = 0, scale = 2) {
    const ow = mem.W >> octave;
    const oh = mem.H >> octave;
    blitBufferToCanvas(this.#device, this.#queue, mem.pyrLevels[octave][scale], ow, oh, canvas);
  }
}
