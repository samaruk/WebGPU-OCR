// src/stages/stage01_image_decode.js
// Decodes uploaded image file → ImageBitmap + RGBA pixel bytes
// GPU: none  CPU: ImageBitmap API + OffscreenCanvas readback
import { BaseStage } from './base/BaseStage.js';

export default class Stage01_ImageDecode extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const file = this.ctx.imageFile;

    // ── Decode via browser ImageBitmap (fastest path) ──────────────
    const bitmap = await createImageBitmap(file, { colorSpaceConversion: 'none' });
    const { width: W, height: H } = bitmap;

    // ── Rasterize to RGBA Uint8 via OffscreenCanvas ────────────────
    const oc  = new OffscreenCanvas(W, H);
    const oc2 = oc.getContext('2d', { willReadFrequently: true });
    oc2.drawImage(bitmap, 0, 0);
    const imageData = oc2.getImageData(0, 0, W, H);
    const rgba = new Uint8ClampedArray(imageData.data); // [H*W*4]

    // Upload to GPU as flat float32 [H*W*4] in range [0,255]
    const floatRGBA = new Float32Array(rgba.length);
    for (let i = 0; i < rgba.length; i++) floatRGBA[i] = rgba[i];

    const gpuBuf = this.makeBuffer(floatRGBA.byteLength, floatRGBA);

    // Store in shared data
    this.data.rawImage  = { bitmap, rgba, floatRGBA, gpuBuf, width: W, height: H };
    this.data.imageMeta = { width: W, height: H, fileSize: file.size, fileName: file.name };

    // ── Visualize ──────────────────────────────────────────────────
    const cv = this.canvas('stage01');
    if (cv) {
      const scale = Math.min(1, 640 / Math.max(W, H));
      cv.width  = Math.round(W * scale);
      cv.height = Math.round(H * scale);
      const ctx2d = cv.getContext('2d');
      ctx2d.drawImage(bitmap, 0, 0, cv.width, cv.height);
      this.badge(cv, `${W}×${H} | ${(file.size/1024).toFixed(0)}KB`);
    }

    this.setGpuMs(0);
    this.bus.emit('log', { level: 'ok', msg: `Stage01: decoded ${W}×${H} in ${(performance.now()-t0).toFixed(1)}ms` });
  }
}
