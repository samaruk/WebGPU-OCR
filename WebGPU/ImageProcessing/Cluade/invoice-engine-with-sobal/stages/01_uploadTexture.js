// stages/01_uploadTexture.js
// Upload an HTMLImageElement / ImageBitmap to a GPU rgba8unorm texture.
// Downscales if either dimension exceeds Config.MAX_DIM.

import { Config } from '../config.js';
import { TextureManager } from '../core/textureManager.js';

/**
 * @param {object} ctx - pipeline context
 * @param {ImageBitmap|HTMLImageElement} ctx.imageBitmap
 * @param {import('../core/gpuContext.js').GPUContext} ctx.gpu
 * @param {TextureManager} ctx.texMgr
 * @returns {{ rgbaTex, width, height }}
 */
export async function uploadTexture(ctx) {
  const { gpu, texMgr } = ctx;
  let bmp = ctx.imageBitmap;

  // ── Resize if needed ────────────────────────────────────────────────────
  let { width, height } = bmp;
  if (width > Config.MAX_DIM || height > Config.MAX_DIM) {
    const scale  = Config.MAX_DIM / Math.max(width, height);
    const newW   = Math.floor(width  * scale);
    const newH   = Math.floor(height * scale);
    const canvas = new OffscreenCanvas(newW, newH);
    const ctx2d  = canvas.getContext('2d');
    ctx2d.drawImage(bmp, 0, 0, newW, newH);
    bmp    = await createImageBitmap(canvas);
    width  = newW;
    height = newH;
    console.info(`[uploadTexture] Downscaled to ${width}×${height}`);
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  const rgbaTex = await texMgr.uploadImage(bmp, 'rgba_input');

  console.info(`[uploadTexture] Uploaded ${width}×${height} → GPU rgba8unorm`);
  return { rgbaTex, width, height };
}
