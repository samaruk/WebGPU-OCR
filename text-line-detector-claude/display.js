/**
 * display.js — Canvas rendering helpers for pipeline stage visualisation.
 *
 * WHY THIS FILE EXISTS:
 *   Each pipeline stage produces a Float32Array result. Visualising these
 *   intermediate outputs is essential for debugging (wrong threshold?
 *   dilation too large? skeleton broken?). These functions convert float
 *   data to RGBA ImageData and draw it on the stage canvases.
 *
 * WHY SHOW INTERMEDIATE STAGES:
 *   The pipeline has 8+ GPU passes before the final result. A bug in any
 *   pass (wrong Sauvola k, over-dilated blobs, incomplete skeleton) produces
 *   wrong OBBs. Visualising each stage lets you immediately identify which
 *   pass is the problem without printf-debugging GPU code.
 *
 * COLOR PALETTE:
 *   Each text line gets a distinct color so overlapping or merged OBBs are
 *   immediately visible. Colors cycle through 10 hues.
 */

/** Color palette for OBB visualisation — 10 distinct hues. */
export const POLY_COLORS = [
  '#22c55e', '#f59e0b', '#38bdf8', '#f87171',
  '#a78bfa', '#fb923c', '#2dd4bf', '#facc15',
  '#4ade80', '#60a5fa'
];

/**
 * Display a float32 grayscale buffer [0,1] as a gray image on a canvas.
 * WHY: Lets you verify the Gaussian blur and grayscale conversion are correct
 *      before binarisation. A visually dark or blown-out result indicates a
 *      wrong luminance formula or buffer copy error.
 */
export function showGray(canvas, data, W, H) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v = data[i] * 255 | 0;
    id.data[i*4] = v; id.data[i*4+1] = v; id.data[i*4+2] = v; id.data[i*4+3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

/**
 * Display a float32 binary buffer (0 or 1) as a two-color image.
 * WHY: Visualises Sauvola output and dilated blobs. Useful for checking
 *      whether k is too aggressive (text disappears), whether dilation
 *      connects lines (adjacent blobs merge), and whether ZS skeleton
 *      thinned correctly.
 *
 * @param {number[]} rgb - Foreground color as [R, G, B] 0-255
 */
export function showBinary(canvas, data, W, H, rgb = [245, 158, 11]) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id = ctx.createImageData(W, H);
  const [r, g, b] = rgb;
  for (let i = 0; i < W * H; i++) {
    if (data[i] > 0.5) { id.data[i*4] = r; id.data[i*4+1] = g; id.data[i*4+2] = b; }
    id.data[i*4+3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

/**
 * Display a float32 distance-transform buffer using a Viridis-like colormap.
 * WHY: The JFA distance transform is kept for visualisation. Seeing the
 *      distance field helps verify that background seeds propagated correctly
 *      and that text regions have the expected stroke-width values.
 *      Dark = close to background, bright yellow = far from background (thick ink).
 */
export function showDist(canvas, data, W, H) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id = ctx.createImageData(W, H);
  let mx = 0;
  for (const v of data) if (v > mx) mx = v;
  for (let i = 0; i < W * H; i++) {
    const t = data[i] / mx;
    id.data[i*4]   = t > 0.5 ? (t - 0.5) * 2 * 200 | 0 : 0;
    id.data[i*4+1] = t * 180 | 0;
    id.data[i*4+2] = t < 0.5 ? t * 2 * 255 | 0 : (1 - t) * 2 * 200 | 0;
    id.data[i*4+3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

/**
 * Private helper — render a packed-RGBA image onto a canvas context,
 * optionally applying a deskew correction via Canvas 2D rotation.
 *
 * WHY CANVAS 2D ROTATION INSTEAD OF A SECOND GPU PASS:
 *   The GPU correction was applied only to the grayscale/binary buffers used
 *   for processing. To show the corrected full-colour photo we'd need an
 *   extra GPU RGBA buffer (W×H×4 bytes extra VRAM) and an extra readback.
 *   Canvas 2D rotation achieves the same visual result in one drawImage()
 *   call with GPU-accelerated compositing — no extra VRAM, no extra readback.
 *
 * ROTATION SIGN CONVENTION:
 *   corrAngleDeg = skewAngle detected by detectSkewFromBlobs (e.g. +30°).
 *   The GPU shader corrected with rad = −skewAngle (CCW by skewAngle degrees).
 *   ctx.rotate() uses CW-positive convention, so:
 *     ctx.rotate(−corrAngleDeg × π/180) = rotate CCW by corrAngleDeg degrees
 *   This exactly mirrors what the GPU did.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Uint32Array}             rgba32      Packed RGBA pixels
 * @param {number}                  W, H        Image dimensions
 * @param {number}                  corrAngleDeg Skew angle to correct (degrees)
 */
function _drawRGBAOnCanvas(ctx, rgba32, W, H, corrAngleDeg) {
  const bytes = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = rgba32[i];
    bytes[i*4]   =  v        & 255;
    bytes[i*4+1] = (v >>  8) & 255;
    bytes[i*4+2] = (v >> 16) & 255;
    bytes[i*4+3] = 255;
  }
  const id = new ImageData(bytes, W, H);

  if (Math.abs(corrAngleDeg) < 0.01) {
    // No correction needed — direct draw
    ctx.putImageData(id, 0, 0);
    return;
  }

  // Render the original photo onto an offscreen canvas, then rotate-draw
  // it onto the destination context. White fills the corners exposed by rotation
  // (matching the GPU shader's out-of-bounds fill value of 1.0 = white).
  const src = document.createElement('canvas');
  src.width = W; src.height = H;
  src.getContext('2d').putImageData(id, 0, 0);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-corrAngleDeg * Math.PI / 180);   // CCW by corrAngleDeg — matches GPU correction
  ctx.drawImage(src, -W / 2, -H / 2);
  ctx.restore();
}

/**
 * Draw OBBs over the corrected (deskewed) image for the "GRAPH PATHS + OBB" stage.
 *
 * WHY POLYGONS STAY IN CORRECTED SPACE (not rotated back to original):
 *   After deskewing, text lines are horizontal and OBBs are axis-aligned.
 *   Displaying them in corrected space makes it trivial to verify whether each
 *   rectangle tightly fits its text line. Rotating back to the original skewed
 *   image would tilt every rectangle and make alignment harder to judge visually.
 *
 * @param {Array<Array<{x,y}>>}     polys        OBBs in corrected-image space
 * @param {Uint32Array}             bg           Packed RGBA image (original photo)
 * @param {number}                  corrAngleDeg Skew angle in degrees (0 = no correction)
 */
export function showPolyDebug(canvas, polys, W, H, bg = null, corrAngleDeg = 0) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (bg instanceof Uint32Array) {
    _drawRGBAOnCanvas(ctx, bg, W, H, corrAngleDeg);
  } else if (bg) {
    // Legacy Float32Array binary background (kept for compatibility)
    const id = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      if (bg[i] > 0.5) { id.data[i*4] = 25; id.data[i*4+1] = 45; id.data[i*4+2] = 30; }
      id.data[i*4+3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }

  polys.forEach((poly, idx) => {
    if (poly.length < 3) return;
    const c = POLY_COLORS[idx % POLY_COLORS.length];
    ctx.strokeStyle = c; ctx.fillStyle = c + '28'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });
}

/**
 * Draw OBBs over the corrected (deskewed) image as the final result.
 *
 * @param {Uint32Array}             rgba32       Packed RGBA original image
 * @param {Array<Array<{x,y}>>}    polys        OBBs in corrected-image space
 * @param {number}                  corrAngleDeg Skew angle in degrees (0 = no correction)
 */
export function showResult(canvas, rgba32, W, H, polys, corrAngleDeg = 0) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  _drawRGBAOnCanvas(ctx, rgba32, W, H, corrAngleDeg);

  ctx.lineWidth = 1.5;
  polys.forEach((poly, idx) => {
    if (poly.length < 3) return;
    const c = POLY_COLORS[idx % POLY_COLORS.length];
    ctx.strokeStyle = c; ctx.fillStyle = c + '1c';
    ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });
}

// ── CCA visualisation ─────────────────────────────────────────────────────────

/**
 * Convert HSL to [R, G, B] (0–255 each).
 * WHY NEEDED: Generating N visually distinct colors is easiest in HSL space
 * (hue = color wheel position, constant saturation/lightness = same perceived
 * brightness). Using the golden-angle step (137.5°) between labels ensures
 * consecutive components have maximally-different hues with no repetition.
 */
function _hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 1/6) { r=c; g=x; }
  else if (h < 2/6) { r=x; g=c; }
  else if (h < 3/6) {      g=c; b=x; }
  else if (h < 4/6) {      g=x; b=c; }
  else if (h < 5/6) { r=x;      b=c; }
  else              { r=c;      b=x; }
  return [(r+m)*255|0, (g+m)*255|0, (b+m)*255|0];
}

/**
 * Visualise CCA output — each connected component gets a unique colour.
 *
 * WHY THIS IS USEFUL:
 *   After dilation + CCA, you need to verify:
 *     - How many blobs were found (count in infoLabel)
 *     - Whether adjacent text lines were correctly separated or merged
 *     - Whether small noise blobs passed the elongation filter
 *   A false-colour map makes all of this immediately obvious: two lines
 *   that share a colour have been merged into one blob (dilation too large),
 *   and a single line shown in two colours is fragmented (dilation too small).
 *
 * WHY GOLDEN-ANGLE HUE STEP (137.5°):
 *   Consecutive integers × 137.5° mod 360° produce a sequence where no two
 *   nearby values share a similar hue. This is the same irrational property
 *   that makes sunflower seed packing efficient. Result: 50+ components all
 *   have visually distinct colours without any explicit palette management.
 *
 * @param {HTMLCanvasElement}       canvas
 * @param {Int32Array}              labelMap   - Per-pixel resolved CCA label (-1 = background)
 * @param {Array<{label,area,...}>} components - CCA component array from cca()
 * @param {number}                  W, H
 */
export function showCCA(canvas, labelMap, components, W, H) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(W, H);

  // Map each unique label → RGB colour using golden-angle hue stepping.
  // Sort by area (largest first) so prominent blobs get the most distinct hues.
  const sorted = [...components].sort((a, b) => b.area - a.area);
  const GOLDEN = 137.508;   // golden angle in degrees
  const labelToRGB = new Map();
  sorted.forEach((comp, i) => {
    const hue = (i * GOLDEN) % 360;
    labelToRGB.set(comp.label, _hslToRgb(hue / 360, 0.75, 0.55));
  });

  // Paint every foreground pixel with its component colour.
  // Background pixels (labelMap[i] === −1) stay black (id initialised to 0,0,0,0).
  for (let i = 0; i < W * H; i++) {
    const lbl = labelMap[i];
    if (lbl < 0) { id.data[i*4+3] = 255; continue; }   // black background
    const rgb = labelToRGB.get(lbl);
    if (!rgb) { id.data[i*4+3] = 255; continue; }
    id.data[i*4]   = rgb[0];
    id.data[i*4+1] = rgb[1];
    id.data[i*4+2] = rgb[2];
    id.data[i*4+3] = 255;
  }

  ctx.putImageData(id, 0, 0);
}
