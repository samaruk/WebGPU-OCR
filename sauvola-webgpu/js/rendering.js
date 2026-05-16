/**
 * @file rendering.js
 * @description Canvas 2D rendering functions for all five output panels.
 *
 * Each function accepts a target <canvas> element and writes pixels/shapes
 * directly to it.  All functions resize the canvas to match the image
 * dimensions before drawing.
 *
 * Panel  Function         Output
 * ─────  ───────────────  ──────────────────────────────────────────────────
 *  02    renderGray       Greyscale luminance values as an 8-bit grey image.
 *  03    renderBinary     Black-on-white Sauvola binarisation result.
 *  04    renderFeatures   Each character region coloured by palette index,
 *                         split sub-regions given distinct colours.
 *  05    renderBoxes      Original image (dimmed) + coloured bounding boxes
 *                         with corner markers and region index tags.
 *
 * Colour utilities
 * ────────────────
 *  hexRgb(hex)   — Parse '#rrggbb' → {r, g, b}.
 *
 * Dependencies
 * ────────────
 *  config.js  — PALETTE, BG_COLOR, NOISE_GRAY, BOX_OVERLAY_ALPHA.
 */

import { PALETTE, BG_COLOR, NOISE_GRAY, BOX_OVERLAY_ALPHA } from './config.js';

// ── COLOUR UTILITIES ──────────────────────────────────────────────────────────

/**
 * Parse a CSS hex colour string into its RGB integer components.
 *
 * @param {string} hex - Six-digit hex string, e.g. '#d4922b'.
 * @returns {{ r: number, g: number, b: number }}
 *
 * @example
 * hexRgb('#d4922b');  // → { r: 212, g: 146, b: 43 }
 */
export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ── RENDERING FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Render the greyscale luminance image to a canvas.
 *
 * Each Float32 value in [0,1] is linearly mapped to [0,255] and written to
 * all three RGB channels (alpha = 255).  The result is a neutral grey image.
 *
 * @param {HTMLCanvasElement} canvas - Target canvas element.
 * @param {Float32Array}      gray   - Flat greyscale array, one float per pixel.
 * @param {number}            W      - Image width in pixels.
 * @param {number}            H      - Image height in pixels.
 */
export function renderGray(canvas, gray, W, H) {
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(W, H);

  for (let i = 0; i < W * H; i++) {
    const v = Math.round(gray[i] * 255);  // [0,1] → [0,255]
    id.data[i*4]   = v;
    id.data[i*4+1] = v;
    id.data[i*4+2] = v;
    id.data[i*4+3] = 255;
  }

  ctx.putImageData(id, 0, 0);
}

/**
 * Render the Sauvola binary mask to a canvas.
 *
 * Foreground pixels (binary = 1) → black (0, 0, 0).
 * Background pixels (binary = 0) → white (255, 255, 255).
 *
 * The classic black-on-white convention matches what OCR engines expect.
 *
 * @param {HTMLCanvasElement} canvas - Target canvas element.
 * @param {Uint32Array}       binary - Flat binary mask: 1 = foreground, 0 = background.
 * @param {number}            W      - Image width in pixels.
 * @param {number}            H      - Image height in pixels.
 */
export function renderBinary(canvas, binary, W, H) {
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(W, H);

  for (let i = 0; i < W * H; i++) {
    const v = binary[i] ? 0 : 255;  // foreground → black, background → white
    id.data[i*4]   = v;
    id.data[i*4+1] = v;
    id.data[i*4+2] = v;
    id.data[i*4+3] = 255;
  }

  ctx.putImageData(id, 0, 0);
}

/**
 * Render a false-colour feature map where each character region (or split
 * sub-region) is drawn in a distinct palette colour.
 *
 * How split sub-regions are coloured
 * ───────────────────────────────────
 * After `splitAllRegions`, two sub-regions may share the same `id` (they
 * both belong to the same original connected component) but occupy different
 * x-ranges.  The `labels` array still contains the original component id for
 * every pixel, so we cannot use labels[i] alone to pick a colour.
 *
 * Instead, this function builds a per-label list of "x-bands" (one per
 * sub-region), each associated with its own palette colour.  For each
 * foreground pixel, we look up the label's band list and find which band's
 * x-range contains the pixel's x-coordinate.
 *
 * Background pixels → dark colour (BG_COLOR).
 * Filtered-out / noise pixels → dim grey (NOISE_GRAY).
 *
 * @param {HTMLCanvasElement} canvas  - Target canvas element.
 * @param {Uint32Array}       binary  - Flat binary mask.
 * @param {Int32Array}        labels  - Per-pixel component ids from connectedComponents.
 * @param {Array}             regions - Filtered + possibly-split region array.
 * @param {number}            W       - Image width.
 * @param {number}            H       - Image height.
 * @returns {number} Total number of foreground pixels drawn.
 */
export function renderFeatures(canvas, binary, labels, regions, W, H) {
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(W, H);

  // ── Build label → x-band colour lookup ──────────────────────────────
  // Key: component id.  Value: [{x1, x2, col}] sorted ascending by x1.
  // For a non-split region there is exactly one band; split sub-regions
  // of the same component produce multiple bands with different colours.
  const labelBands = new Map();

  regions.forEach((r, i) => {
    const col = hexRgb(PALETTE[i % PALETTE.length]);
    if (!labelBands.has(r.id)) labelBands.set(r.id, []);
    labelBands.get(r.id).push({ x1: r.x1, x2: r.x1 + r.w - 1, col });
  });

  // Sort each band list by x1 so a linear scan finds the correct band quickly
  for (const bands of labelBands.values()) {
    bands.sort((a, b) => a.x1 - b.x1);
  }

  // ── Write pixel colours ──────────────────────────────────────────────
  let textPx = 0;

  for (let i = 0; i < W * H; i++) {
    if (!binary[i]) {
      // Background pixel — dark canvas colour
      id.data[i*4]   = BG_COLOR.r;
      id.data[i*4+1] = BG_COLOR.g;
      id.data[i*4+2] = BG_COLOR.b;
      id.data[i*4+3] = 255;
      continue;
    }

    textPx++;

    const bands = labelBands.get(labels[i]);
    if (!bands) {
      // Foreground pixel whose component was filtered out — dim grey
      id.data[i*4]   = NOISE_GRAY;
      id.data[i*4+1] = NOISE_GRAY;
      id.data[i*4+2] = NOISE_GRAY;
      id.data[i*4+3] = 255;
      continue;
    }

    // Find the x-band that contains this pixel's column
    const px = i % W;
    let c = bands[0].col;
    for (const b of bands) {
      if (px >= b.x1 && px <= b.x2) { c = b.col; break; }
    }

    id.data[i*4]   = c.r;
    id.data[i*4+1] = c.g;
    id.data[i*4+2] = c.b;
    id.data[i*4+3] = 255;
  }

  ctx.putImageData(id, 0, 0);
  return textPx;
}

/**
 * Render the original image (dimmed) overlaid with coloured bounding boxes
 * and region index tags.
 *
 * Visual elements per region
 * ──────────────────────────
 *  • Subtle fill (10% opacity) over the bounding rectangle.
 *  • 1.8 px stroke around the bounding rectangle.
 *  • Corner markers (L-shaped ticks at all four corners).
 *  • Small region-index badge ('R1', 'R2', …) above or below the box.
 *
 * Regions are sorted largest-to-smallest before rendering so that small
 * characters are drawn on top of overlapping large regions.
 *
 * @param {HTMLCanvasElement} canvas      - Target canvas element.
 * @param {ImageData}         origImgData - Original image pixels.
 * @param {Array}             regions     - Character regions to draw.
 * @param {number}            W           - Image width.
 * @param {number}            H           - Image height.
 */
export function renderBoxes(canvas, origImgData, regions, W, H) {
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── Draw dimmed original ────────────────────────────────────────────
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(origImgData, 0, 0);
  ctx.globalAlpha = BOX_OVERLAY_ALPHA;
  ctx.drawImage(tmp, 0, 0);
  ctx.globalAlpha = 1;

  // Sort by area descending — large regions drawn first, small on top
  const sorted = [...regions].sort((a, b) => b.n - a.n);

  sorted.forEach((r, i) => {
    const col          = PALETTE[i % PALETTE.length];
    const { r: cr, g: cg, b: cb } = hexRgb(col);

    // ── Subtle fill ──────────────────────────────────────────────────
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.10)`;
    ctx.fillRect(r.x1, r.y1, r.w, r.h);

    // ── Stroke outline ───────────────────────────────────────────────
    ctx.strokeStyle = col;
    ctx.lineWidth   = 1.8;
    ctx.strokeRect(r.x1 + 0.5, r.y1 + 0.5, r.w - 1, r.h - 1);

    // ── Corner tick markers ──────────────────────────────────────────
    ctx.fillStyle = col;
    // Top-left
    ctx.fillRect(r.x1,           r.y1,           5, 2);
    ctx.fillRect(r.x1,           r.y1,           2, 5);
    // Top-right
    ctx.fillRect(r.x1 + r.w - 5, r.y1,           5, 2);
    ctx.fillRect(r.x1 + r.w - 2, r.y1,           2, 5);
    // Bottom-left
    ctx.fillRect(r.x1,           r.y1 + r.h - 2, 5, 2);
    ctx.fillRect(r.x1,           r.y1 + r.h - 5, 2, 5);
    // Bottom-right
    ctx.fillRect(r.x1 + r.w - 5, r.y1 + r.h - 2, 5, 2);
    ctx.fillRect(r.x1 + r.w - 2, r.y1 + r.h - 5, 2, 5);

    // ── Region index badge ───────────────────────────────────────────
    ctx.font      = '600 9px "DM Mono", monospace';
    const lbl     = `R${i + 1}`;
    const tw      = ctx.measureText(lbl).width;
    // Place badge above the box if there is room, otherwise below
    const tx = Math.max(0, Math.min(W - tw - 8, r.x1));
    const ty = r.y1 > 15 ? r.y1 - 1 : r.y1 + r.h + 13;

    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.88)`;
    ctx.beginPath();
    ctx.roundRect(tx - 1, ty - 12, tw + 8, 14, 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(lbl, tx + 3, ty - 1);
  });
}
