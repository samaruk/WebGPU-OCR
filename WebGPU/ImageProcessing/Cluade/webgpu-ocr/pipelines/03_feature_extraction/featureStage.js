
import { SobelKernel }             from './kernels/sobel.js';
import { GradientMagnitudeKernel } from './kernels/gradientMagnitude.js';
import { HOGFeaturesKernel }       from './kernels/hogFeatures.js';
import { TextureFeaturesKernel }   from './kernels/textureFeatures.js';
import { CornerDetectorKernel }    from './kernels/cornerDetector.js';
import { Tensor }                  from '../../core/tensor.js';

export class FeatureStage {
  constructor(device) { this.device = device; }

  async init() {
    this.sobel  = new SobelKernel(this.device);
    this.grad   = new GradientMagnitudeKernel(this.device);
    this.hog    = new HOGFeaturesKernel(this.device);
    this.lbp    = new TextureFeaturesKernel(this.device);
    this.corner = new CornerDetectorKernel(this.device);
    await Promise.all([
      this.sobel.init(), this.grad.init(), this.hog.init(),
      this.lbp.init(), this.corner.init(),
    ]);
  }

  async run({ gray, width, height }) {
    const enc = this.device.createCommandEncoder({ label: 'features' });
    const N   = width * height;

    const gx   = new Tensor(this.device, [N], 'f32');
    const gy   = new Tensor(this.device, [N], 'f32');
    const mag  = new Tensor(this.device, [N], 'f32');
    const ang  = new Tensor(this.device, [N], 'f32');

    const cw = Math.ceil(width / 8), ch = Math.ceil(height / 8);
    const hogBuf = new Tensor(this.device, [cw * ch * 9], 'f32');
    const lbp    = new Tensor(this.device, [N], 'u32');
    const resp   = new Tensor(this.device, [N], 'f32');

    this.sobel.run(enc, gray.buffer, gx.buffer, gy.buffer, width, height);
    this.grad.run(enc, gx.buffer, gy.buffer, mag.buffer, ang.buffer, width, height);
    this.hog.run(enc, mag.buffer, ang.buffer, hogBuf.buffer, width, height);
    this.lbp.run(enc, gray.buffer, lbp.buffer, width, height);
    this.corner.run(enc, gx.buffer, gy.buffer, resp.buffer, width, height);

    this.device.queue.submit([enc.finish()]);
    await this.device.queue.onSubmittedWorkDone();

    return { mag, ang, hog: hogBuf, lbp, corners: resp, gx, gy, width, height };
  }
}
