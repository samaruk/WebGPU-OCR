/**
 * preprocessing/bilateralFilter.js – edge-preserving bilateral filter (CPU).
 */
export class BilateralFilterPass {
  #ctx;
  constructor(ctx) { this.#ctx = ctx; }

  async run(inputTex, width, height, sigmaD = 3, sigmaR = 0.15) {
    const raw  = await this.#ctx.textureManager.readback(inputTex, width, height);
    const gray = new Float32Array(width * height);
    for (let i = 0; i < gray.length; i++) gray[i] = raw[i * 4] / 255;

    const out   = bilateral(gray, width, height, sigmaD, sigmaR);
    const rgba  = new Uint8Array(width * height * 4);
    for (let i = 0; i < out.length; i++) {
      const v = Math.round(out[i] * 255);
      rgba[i*4] = v; rgba[i*4+1] = v; rgba[i*4+2] = v; rgba[i*4+3] = 255;
    }
    const bitmap = await createImageBitmap(new ImageData(rgba, width, height));
    return this.#ctx.textureManager.fromBitmap(bitmap, 'rgba8unorm');
  }
}

function bilateral(src, W, H, sigD, sigR) {
  const r   = Math.ceil(2 * sigD);
  const dst = new Float32Array(W * H);
  const inv2D = 1 / (2 * sigD * sigD);
  const inv2R = 1 / (2 * sigR * sigR);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, wsum = 0;
      const vc = src[y * W + x];
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = Math.max(0, Math.min(W - 1, x + dx));
          const ny = Math.max(0, Math.min(H - 1, y + dy));
          const v  = src[ny * W + nx];
          const wd = Math.exp(-(dx*dx + dy*dy) * inv2D);
          const wr = Math.exp(-(v - vc) * (v - vc) * inv2R);
          sum += v * wd * wr; wsum += wd * wr;
        }
      }
      dst[y * W + x] = sum / wsum;
    }
  }
  return dst;
}
