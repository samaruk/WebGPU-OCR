
import { UploadImageKernel }  from './kernels/uploadImage.js';
import { RGBAToFloatKernel }  from './kernels/rgbaToFloat.js';
import { TextureCopyKernel }  from './kernels/textureCopy.js';
import { Tensor }             from '../../core/tensor.js';

export class UploadStage {
  constructor(device) { this.device = device; }

  async init() {
    this.uploadKernel = new UploadImageKernel(this.device);
    this.rgbaKernel   = new RGBAToFloatKernel(this.device);
    this.copyKernel   = new TextureCopyKernel(this.device);
    await Promise.all([
      this.uploadKernel.init(),
      this.rgbaKernel.init(),
      this.copyKernel.init(),
    ]);
  }

  /**
   * Upload an ImageData or HTMLImageElement to GPU.
   * @returns {{ rgbaTensor, planarTensor, width, height }}
   */
  async run(imageData) {
    const W = imageData.width, H = imageData.height;
    // Pack RGBA bytes into Uint32 on CPU
    const raw = imageData.data;  // Uint8ClampedArray
    const packed = new Uint32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      packed[i] = raw[i*4] | (raw[i*4+1] << 8) | (raw[i*4+2] << 16) | (raw[i*4+3] << 24);
    }

    const srcBuf = this.device.createBuffer({
      size: packed.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(srcBuf, 0, packed);

    const rgbaTensor   = new Tensor(this.device, [H, W, 4], 'f32');
    const planarTensor = new Tensor(this.device, [3, H, W], 'f32');

    const enc = this.device.createCommandEncoder({ label: 'uploadStage' });
    this.uploadKernel.run(enc, srcBuf, rgbaTensor.buffer, W, H);
    this.rgbaKernel.run(enc, rgbaTensor.buffer, planarTensor.buffer, W, H);
    this.device.queue.submit([enc.finish()]);
    await this.device.queue.onSubmittedWorkDone();

    srcBuf.destroy();
    return { rgbaTensor, planarTensor, width: W, height: H };
  }
}
