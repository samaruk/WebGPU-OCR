/**
 * pipeline/stage0-upload.js
 * Stage 0 — Upload binary mask to GPU as an r8unorm texture.
 *
 * Reads the drawing canvas, extracts the R channel (0–255),
 * creates a GPUTexture, and writes the grayscale data to it.
 * White pixels (≥128) = foreground; black pixels (<128) = background/seed.
 *
 * Returns the live GPUTexture — caller is responsible for calling .destroy().
 *
 * @param {GPUDevice}          device
 * @param {HTMLCanvasElement}  canvas   — the binary-mask canvas
 * @param {number}             W        — canvas pixel width
 * @param {number}             H        — canvas pixel height
 * @returns {{ tex: GPUTexture, gray: Uint8Array }}
 */
import { log } from '../ui/log.js';

export function stage0Upload(device, canvas, W, H) {
  const ctx     = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, W, H);
  const gray    = new Uint8Array(W * H);

  // Extract R channel — canvas is already grayscale (R=G=B)
  for (let i = 0; i < W * H; i++) {
    gray[i] = imgData.data[i * 4];
  }

  const tex = device.createTexture({
    label  : 'binaryTex',
    size   : [W, H],
    format : 'r8unorm',
    usage  : GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture: tex },
    gray,
    { bytesPerRow: W },
    [W, H],
  );

  log(`[0] Binary r8unorm tex → GPU  ${W}×${H}  (${(W * H / 1000).toFixed(1)}k px)`, 'info');
  return { tex, gray };
}
