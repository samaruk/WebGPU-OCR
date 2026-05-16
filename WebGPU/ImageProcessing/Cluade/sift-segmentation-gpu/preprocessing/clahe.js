/**
 * preprocessing/clahe.js – Contrast-Limited Adaptive Histogram Equalisation (CPU fallback).
 * For a production GPU implementation each tile histogram would run as a compute shader.
 * This version reads back to CPU, processes, and re-uploads (fine for demo purposes).
 */
export class CLAHEPass {
  #ctx;
  constructor(ctx) { this.#ctx = ctx; }

  async run(inputTex, width, height, clipLimit = 2.0, tileSize = 8) {
    // Read back luminance data
    const raw  = await this.#ctx.textureManager.readback(inputTex, width, height);
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i++) gray[i] = raw[i * 4];

    const out = clahe(gray, width, height, tileSize, clipLimit);

    // Re-upload as texture
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < out.length; i++) { rgba[i*4] = out[i]; rgba[i*4+1] = out[i]; rgba[i*4+2] = out[i]; rgba[i*4+3] = 255; }
    const bitmap  = await createImageBitmap(new ImageData(rgba, width, height));
    return this.#ctx.textureManager.fromBitmap(bitmap, 'rgba8unorm');
  }
}

/** Minimal CLAHE on Uint8Array[w*h] */
function clahe(src, W, H, ts, clip) {
  const numX = Math.ceil(W / ts), numY = Math.ceil(H / ts);
  const luts  = new Array(numX * numY);

  // Compute LUT per tile
  for (let ty = 0; ty < numY; ty++) {
    for (let tx = 0; tx < numX; tx++) {
      const hist = new Int32Array(256);
      const x0 = tx * ts, y0 = ty * ts;
      const x1 = Math.min(x0 + ts, W), y1 = Math.min(y0 + ts, H);
      const n  = (x1 - x0) * (y1 - y0);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hist[src[y * W + x]]++;
      // Clip
      const limit = Math.round(clip * n / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++) { if (hist[i] > limit) { excess += hist[i] - limit; hist[i] = limit; } }
      const inc = Math.floor(excess / 256);
      for (let i = 0; i < 256; i++) hist[i] += inc;
      // CDF
      const lut = new Uint8Array(256); let cdf = 0;
      for (let i = 0; i < 256; i++) { cdf += hist[i]; lut[i] = Math.round(cdf * 255 / n); }
      luts[ty * numX + tx] = lut;
    }
  }

  // Bilinear interpolation
  const dst = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v  = src[y * W + x];
      const tx = Math.min((x + ts / 2) / ts - 0.5, numX - 1);
      const ty2 = Math.min((y + ts / 2) / ts - 0.5, numY - 1);
      const tx0 = Math.max(0, Math.floor(tx)), tx1 = Math.min(numX - 1, tx0 + 1);
      const ty0 = Math.max(0, Math.floor(ty2)), ty1 = Math.min(numY - 1, ty0 + 1);
      const fx = tx - tx0, fy = ty2 - ty0;
      const q00 = luts[ty0 * numX + tx0][v], q10 = luts[ty0 * numX + tx1][v];
      const q01 = luts[ty1 * numX + tx0][v], q11 = luts[ty1 * numX + tx1][v];
      dst[y * W + x] = Math.round(q00*(1-fx)*(1-fy) + q10*fx*(1-fy) + q01*(1-fx)*fy + q11*fx*fy);
    }
  }
  return dst;
}
