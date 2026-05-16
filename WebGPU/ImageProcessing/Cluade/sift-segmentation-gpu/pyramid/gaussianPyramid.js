/**
 * pyramid/gaussianPyramid.js – builds the full Gaussian scale-space pyramid.
 */
import { GaussianBlurPass }      from '../preprocessing/gaussianBlur.js';
import { DownsamplePass }        from './downsample.js';
import { buildSigmaSchedule, sigmaForBlur } from './pyramidConfig.js';

export class GaussianPyramid {
  #ctx; #cfg;
  constructor(ctx, cfg) { this.#ctx = ctx; this.#cfg = cfg; }

  async build(baseTex, baseW, baseH) {
    const { octaves, scalesPerOctave, initialSigma } = this.#cfg;
    const blurPass      = new GaussianBlurPass(this.#ctx);
    const downsample    = new DownsamplePass(this.#ctx);
    const sigmaSchedule = buildSigmaSchedule(octaves, scalesPerOctave, initialSigma);

    const result = { octaves: [], sigmaSchedule };
    let currentBase = baseTex;
    let W = baseW, H = baseH;

    for (let o = 0; o < octaves; o++) {
      const scales = [];
      const sigmas = sigmaSchedule[o];
      let prevSigma = sigmas[0];
      let prevTex   = (o === 0) ? await blurPass.run(currentBase, W, H, initialSigma) : currentBase;

      // Store first scale
      const firstData = await this.#ctx.textureManager.readback(prevTex, W, H);
      scales.push({ texture: prevTex, width: W, height: H, sigma: sigmas[0], cpuData: toGray(firstData, W, H) });

      for (let s = 1; s < sigmas.length; s++) {
        const ds = sigmaForBlur(sigmas[s], prevSigma);
        const blurred = ds > 0.5
          ? await blurPass.run(prevTex, W, H, ds)
          : prevTex;

        const data = await this.#ctx.textureManager.readback(blurred, W, H);
        scales.push({ texture: blurred, width: W, height: H, sigma: sigmas[s], cpuData: toGray(data, W, H) });
        prevTex = blurred; prevSigma = sigmas[s];
      }

      result.octaves.push({ scales, width: W, height: H });

      // Prepare next octave base = scale[scalesPerOctave] downsampled
      const baseScale = scales[scalesPerOctave];
      W = Math.max(1, Math.floor(W / 2));
      H = Math.max(1, Math.floor(H / 2));
      currentBase = await downsample.run(baseScale.texture, W, H);
    }

    return result;
  }
}

function toGray(rgba, W, H) {
  const g = new Uint8Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = rgba[i * 4];
  return g;
}
