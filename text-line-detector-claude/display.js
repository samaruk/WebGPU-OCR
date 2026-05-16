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
 * Draw OBBs over a faint binary background for the "GRAPH PATHS" debug stage.
 * WHY: Shows the final polygon geometry against the binary image so you can
 *      verify each OBB aligns with actual ink pixels, check for multi-line
 *      OBBs, and see which lines were detected or missed.
 *
 * @param {Array<Array<{x,y}>>} polys - Array of 4-corner polygons
 * @param {Float32Array|null}   bg    - Optional binary background for context
 */
export function showPolyDebug(canvas, polys, W, H, bg = null) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (bg) {
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
 * Draw the original image with OBB overlays as the final result.
 * WHY RGBA32 INSTEAD OF IMAGEBITMAP: The original image is stored as a
 *      Uint32Array (packed RGBA) from the initial load. We unpack it here
 *      to draw on the result canvas rather than keeping a second copy as
 *      an ImageBitmap, saving memory.
 *
 * @param {Uint32Array}          rgba32 - Packed RGBA image data
 * @param {Array<Array<{x,y}>>} polys  - Final OBB polygons
 */
export function showResult(canvas, rgba32, W, H, polys) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Unpack Uint32 RGBA to Uint8ClampedArray for ImageData
  const bytes = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = rgba32[i];
    bytes[i*4] = v & 255; bytes[i*4+1] = (v >> 8) & 255;
    bytes[i*4+2] = (v >> 16) & 255; bytes[i*4+3] = 255;
  }
  ctx.putImageData(new ImageData(bytes, W, H), 0, 0);

  // Draw OBBs as semi-transparent colored rectangles
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
