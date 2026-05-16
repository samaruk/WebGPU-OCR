// stages/13_regionCropper.js — Crop detected regions for OCR input

import { readTexture } from '../core/utils.js';

/**
 * Returns an array of { canvas, x, y, w, h } for each detected text line region.
 * These are 2D canvas elements ready to be passed to the OCR stage.
 */
export async function regionCropper(ctx, bm, w, h, textLines, table) {
  // Read source texture as RGBA
  const src = bm.getTexture('source');
  const pixels = await readTexture(ctx.device, src, w, h, 4);

  const regions = [];

  // Crop each text line band (full width)
  for (const line of textLines) {
    const lh = line.end - line.start + 1;
    if (lh < 4) continue;
    const padV = 2;
    const y0 = Math.max(0, line.start - padV);
    const y1 = Math.min(h - 1, line.end + padV);
    const rh = y1 - y0 + 1;
    const canvas = new OffscreenCanvas(w, rh);
    const ctx2d = canvas.getContext('2d');
    const idata = ctx2d.createImageData(w, rh);
    idata.data.set(pixels.subarray(y0 * w * 4, (y0 + rh) * w * 4));
    ctx2d.putImageData(idata, 0, 0);
    regions.push({ canvas, x: 0, y: line.start, w, h: rh, type: 'line' });
  }

  // Crop table region
  if (table) {
    const { x, y, w: tw, h: th } = table;
    const x0 = Math.max(0, x - 4), y0 = Math.max(0, y - 4);
    const x1 = Math.min(w - 1, x + tw + 4), y1 = Math.min(h - 1, y + th + 4);
    const rw = x1 - x0 + 1, rh = y1 - y0 + 1;
    const canvas = new OffscreenCanvas(rw, rh);
    const ctx2d = canvas.getContext('2d');
    const idata = ctx2d.createImageData(rw, rh);
    for (let row = 0; row < rh; row++) {
      for (let col = 0; col < rw; col++) {
        const srcOff = ((y0 + row) * w + (x0 + col)) * 4;
        const dstOff = (row * rw + col) * 4;
        idata.data[dstOff]     = pixels[srcOff];
        idata.data[dstOff + 1] = pixels[srcOff + 1];
        idata.data[dstOff + 2] = pixels[srcOff + 2];
        idata.data[dstOff + 3] = 255;
      }
    }
    ctx2d.putImageData(idata, 0, 0);
    regions.push({ canvas, x: x0, y: y0, w: rw, h: rh, type: 'table' });
  }

  return regions;
}
