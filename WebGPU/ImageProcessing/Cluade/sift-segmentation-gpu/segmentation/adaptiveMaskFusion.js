/**
 * segmentation/adaptiveMaskFusion.js
 * Fuses gradient magnitude + keypoint density into a binary foreground mask.
 */
import { GradientMap } from '../stroke/gradientMap.js';

export class AdaptiveMaskFusion {
  #ctx; #cfg;
  constructor(ctx, cfg) { this.#ctx = ctx; this.#cfg = cfg; }

  async run(grayTex, keypoints, W, H) {
    const { maskFusionAlpha = 0.5 } = this.#cfg;

    // Gradient magnitude map
    const gmap = new GradientMap(this.#ctx);
    const { magTex } = await gmap.run(grayTex, W, H);

    // Keypoint density map (CPU)
    const kpDensity = new Float32Array(W * H);
    const sigma = 16;
    for (const kp of keypoints) {
      const r = Math.ceil(2 * sigma);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = Math.round(kp.x) + dx;
          const ny = Math.round(kp.y) + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const w = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
          kpDensity[ny * W + nx] += w;
        }
      }
    }
    // Normalise density
    let maxD = 0;
    for (const v of kpDensity) if (v > maxD) maxD = v;
    if (maxD > 0) for (let i = 0; i < kpDensity.length; i++) kpDensity[i] /= maxD;

    // Read gradient magnitude
    const magRaw  = await this.#ctx.textureManager.readback(magTex, W, H);
    const magData = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const rgba = new Float32Array(magRaw.buffer, i * 4, 1);
      magData[i] = Math.min(1, rgba[0]);
    }

    // Fuse
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const score = (1 - maskFusionAlpha) * magData[i] + maskFusionAlpha * kpDensity[i];
      mask[i] = score > 0.15 ? 255 : 0;
    }

    // Re-upload mask as texture
    const rgba = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      rgba[i*4] = mask[i]; rgba[i*4+1] = mask[i]; rgba[i*4+2] = mask[i]; rgba[i*4+3] = 255;
    }
    const bm = await createImageBitmap(new ImageData(rgba, W, H));
    return this.#ctx.textureManager.fromBitmap(bm, 'rgba8unorm');
  }
}
