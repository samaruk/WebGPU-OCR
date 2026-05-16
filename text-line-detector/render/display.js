/**
 * render/display.js — Canvas 2D visualisation of intermediate and final pipeline stages.
 *
 * WHY A DEDICATED DISPLAY MODULE:
 *   Visualisation code mixes DOM manipulation with image-data math. Keeping it separate
 *   from both the GPU pipeline (gpu/pipeline.js) and the UI event handling (ui/controls.js)
 *   means each function has one responsibility: convert a typed array into a visible Canvas.
 *
 * WHY INTERMEDIATE STAGE VISUALISATIONS:
 *   The binary, dilated, and skeleton canvases are not cosmetic — they are the primary
 *   debugging tool for tuning parameters. If dilation is too aggressive (lines merge) or
 *   too conservative (letters disconnect), the dilated canvas immediately shows the problem
 *   without needing to add console.log calls or GPU debugging tools.
 *
 * SCALING STRATEGY:
 *   All debug canvases are capped at MAX_DEBUG × MAX_DEBUG px regardless of input size.
 *   WHY: Rendering a 4000×3000 grayscale debug canvas would allocate 48 MB of ImageData
 *   and take ~100 ms in Canvas 2D. The debug views are thumbnails; downscaling to
 *   600 px preserves visual clarity while keeping the DOM lightweight.
 */

import { PALETTE } from '../config.js';

/** Maximum pixel dimension for debug canvas thumbnails. */
const MAX_DEBUG = 600;

/**
 * showDebug — Render a binary u32 array (0=background, 1=foreground) as a greyscale canvas.
 *
 * WHY setImageData (not drawImage from an ImageBitmap):
 *   createImageBitmap requires an async await. putImageData is synchronous, which avoids
 *   an additional async boundary in the already-async pipeline callback chain.
 *
 * @param {string}      canvasId — ID of the target <canvas> element
 * @param {string}      phId     — ID of the placeholder <div> to hide
 * @param {Uint32Array} data     — binary mask (0 or 1 per pixel)
 * @param {number}      W, H     — source image dimensions
 */
export function showDebug(canvasId, phId, data, W, H) {
  const scale = Math.min(1, MAX_DEBUG / Math.max(W, H));
  const dW = Math.round(W * scale), dH = Math.round(H * scale);
  const canvas = document.getElementById(canvasId);
  canvas.width = dW; canvas.height = dH;
  const ctx  = canvas.getContext('2d');
  const imgD = ctx.createImageData(dW, dH);

  for (let dy = 0; dy < dH; dy++) {
    for (let dx = 0; dx < dW; dx++) {
      const sx = Math.min(W-1, (dx / scale) | 0);
      const sy = Math.min(H-1, (dy / scale) | 0);
      const v  = data[sy * W + sx] ? 220 : 8;
      const k  = (dy * dW + dx) * 4;
      imgD.data[k] = imgD.data[k+1] = imgD.data[k+2] = v;
      imgD.data[k+3] = 255;
    }
  }

  ctx.putImageData(imgD, 0, 0);
  canvas.style.display = 'block';
  document.getElementById(phId).style.display = 'none';
}

/**
 * showLabelMap — Colour-code the GPU CCA label array for visual inspection.
 *
 * WHY NECESSARY:
 *   The label map is the primary diagnostic for CCA correctness. If two text lines have
 *   the same colour, their blobs merged during dilation — dilH is too large. If a single
 *   line is two colours, the CCA didn't converge — increase ccaIters.
 *
 * PALETTE CYCLING:
 *   Labels are assigned PALETTE colours in order (mod PALETTE.length). Background
 *   pixels (labelArr[i] === 0xFFFFFFFF) are rendered as near-black (value 8).
 *
 * @param {Uint32Array} labelArr — compact label per pixel [0, K) or 0xFFFFFFFF
 * @param {number}      K        — number of components
 */
export function showLabelMap(canvasId, phId, labelArr, K, W, H) {
  const scale = Math.min(1, MAX_DEBUG / Math.max(W, H));
  const dW = Math.round(W * scale), dH = Math.round(H * scale);
  const canvas = document.getElementById(canvasId);
  canvas.width = dW; canvas.height = dH;
  const ctx  = canvas.getContext('2d');
  const imgD = ctx.createImageData(dW, dH);

  // Pre-parse hex palette strings into [r,g,b] arrays for fast lookup.
  const colours = PALETTE.slice(0, Math.min(K, PALETTE.length)).map(hex => [
    parseInt(hex.slice(1,3), 16),
    parseInt(hex.slice(3,5), 16),
    parseInt(hex.slice(5,7), 16),
  ]);

  for (let dy = 0; dy < dH; dy++) {
    for (let dx = 0; dx < dW; dx++) {
      const sx  = Math.min(W-1, (dx / scale) | 0);
      const sy  = Math.min(H-1, (dy / scale) | 0);
      const lbl = labelArr[sy * W + sx];
      const k   = (dy * dW + dx) * 4;
      if (lbl === 0xFFFFFFFF || lbl >= K) {
        imgD.data[k] = imgD.data[k+1] = imgD.data[k+2] = 8;
      } else {
        const rgb = colours[lbl % colours.length];
        imgD.data[k] = rgb[0]; imgD.data[k+1] = rgb[1]; imgD.data[k+2] = rgb[2];
      }
      imgD.data[k+3] = 255;
    }
  }

  ctx.putImageData(imgD, 0, 0);
  canvas.style.display = 'block';
  document.getElementById(phId).style.display = 'none';
}
