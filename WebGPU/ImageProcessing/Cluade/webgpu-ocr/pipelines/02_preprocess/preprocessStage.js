
import { GrayscaleKernel }             from './kernels/grayscale.js';
import { ResizeBilinearKernel }         from './kernels/resizeBilinear.js';
import { GaussianBlurKernel }           from './kernels/gaussianBlur.js';
import { BilateralFilterKernel }        from './kernels/bilateralFilter.js';
import { IlluminationCorrectionKernel } from './kernels/illuminationCorrection.js';
import { ShadingRemovalKernel }         from './kernels/shadingRemoval.js';
import { NormalizeKernel }              from './kernels/normalize.js';
import { DeskewEstimationKernel }       from './kernels/deskewEstimation.js';
import { DeskewRotateKernel }           from './kernels/deskewRotate.js';
import { Tensor }                       from '../../core/tensor.js';
import { CONFIG }                       from '../../config.js';

export class PreprocessStage {
  constructor(device) { this.device = device; }

  async init() {
    this.grayKernel   = new GrayscaleKernel(this.device);
    this.resizeKernel = new ResizeBilinearKernel(this.device);
    this.blurKernel   = new GaussianBlurKernel(this.device);
    this.bilKernel    = new BilateralFilterKernel(this.device);
    this.illumKernel  = new IlluminationCorrectionKernel(this.device);
    this.shadeKernel  = new ShadingRemovalKernel(this.device);
    this.normKernel   = new NormalizeKernel(this.device);
    this.deskewEst    = new DeskewEstimationKernel(this.device);
    this.deskewRot    = new DeskewRotateKernel(this.device);
    await Promise.all([
      this.grayKernel.init(), this.resizeKernel.init(),
      this.blurKernel.init(), this.bilKernel.init(),
      this.illumKernel.init(), this.shadeKernel.init(),
      this.normKernel.init(), this.deskewEst.init(), this.deskewRot.init(),
    ]);
  }

  async run({ rgbaTensor, width, height }) {
    const TW = CONFIG.TARGET_WIDTH, TH = CONFIG.TARGET_HEIGHT;
    const enc = this.device.createCommandEncoder({ label: 'preprocess' });

    // 1. Resize
    const resized = new Tensor(this.device, [TH, TW, 4], 'f32');
    this.resizeKernel.run(enc, rgbaTensor.buffer, resized.buffer, width, height, TW, TH, 4);

    // 2. Grayscale
    const gray = new Tensor(this.device, [TH * TW], 'f32');
    this.grayKernel.run(enc, resized.buffer, gray.buffer, TW, TH);

    // 3. Illumination correction
    const illum = new Tensor(this.device, [TH * TW], 'f32');
    this.illumKernel.run(enc, gray.buffer, illum.buffer, TW, TH);

    // 4. Shading removal
    const shade = new Tensor(this.device, [TH * TW], 'f32');
    this.shadeKernel.run(enc, illum.buffer, shade.buffer, TW, TH);

    // 5. Bilateral filter (using grayscale)
    const bilateral = new Tensor(this.device, [TH * TW], 'f32');
    this.bilKernel.run(enc, shade.buffer, bilateral.buffer, TW, TH);

    // 6. Normalize (reuse resized RGBA)
    const normalized = new Tensor(this.device, [TH, TW, 4], 'f32');
    this.normKernel.run(enc, resized.buffer, normalized.buffer, TW, TH);

    this.device.queue.submit([enc.finish()]);
    await this.device.queue.onSubmittedWorkDone();

    return { gray: bilateral, normalized, resized, width: TW, height: TH };
  }
}
