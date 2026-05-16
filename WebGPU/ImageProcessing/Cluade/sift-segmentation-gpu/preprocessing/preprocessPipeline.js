/**
 * preprocessing/preprocessPipeline.js – orchestrates all preprocessing stages.
 */
import { GrayscalePass }       from './grayscale.js';
import { GammaCorrectionPass } from './gammaCorrection.js';
import { CLAHEPass }           from './clahe.js';
import { BilateralFilterPass } from './bilateralFilter.js';

export class PreprocessPipeline {
  #ctx; #cfg;
  constructor(ctx, cfg) { this.#ctx = ctx; this.#cfg = cfg; }

  async run(inputTex, width, height) {
    const { gamma, claheClip, claheTileSize, bilateralEnabled, bilateralSigmaD, bilateralSigmaR } = this.#cfg;

    // 1. Grayscale
    const gray = new GrayscalePass(this.#ctx);
    let tex = await gray.run(inputTex, width, height);

    // 2. Gamma
    if (Math.abs(gamma - 1.0) > 0.01) {
      const gp = new GammaCorrectionPass(this.#ctx);
      tex = await gp.run(tex, width, height, gamma);
    }

    // 3. CLAHE
    const clahe = new CLAHEPass(this.#ctx);
    tex = await clahe.run(tex, width, height, claheClip, claheTileSize);

    // 4. Bilateral
    if (bilateralEnabled) {
      const bf = new BilateralFilterPass(this.#ctx);
      tex = await bf.run(tex, width, height, bilateralSigmaD, bilateralSigmaR);
    }

    return tex;
  }
}
