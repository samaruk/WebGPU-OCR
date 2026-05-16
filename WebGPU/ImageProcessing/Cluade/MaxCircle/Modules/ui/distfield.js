/**
 * ui/distfield.js
 * Visualises the GPU distance field on a 2D canvas using a thermal colormap.
 *
 * Thermal colormap stops (black → blue → cyan → green → yellow → red → white):
 *   0.00 → [  0,   0,   0]
 *   0.17 → [  0,   0, 180]
 *   0.33 → [  0, 200, 220]
 *   0.50 → [  0, 200,   0]
 *   0.67 → [220, 220,   0]
 *   0.83 → [220,  80,   0]
 *   1.00 → [255, 255, 255]
 *
 * Also decodes FP16 (f16) arrays from GPU when needed.
 */

const THERMAL_STOPS = [
  [  0,   0,   0],
  [  0,   0, 180],
  [  0, 200, 220],
  [  0, 200,   0],
  [220, 220,   0],
  [220,  80,   0],
  [255, 255, 255],
];

/**
 * Map a normalised value [0..1] through the thermal colormap.
 * @param {number} t — [0, 1]
 * @returns {[number, number, number]} RGB triple
 */
function thermalColor(t) {
  const seg = t * (THERMAL_STOPS.length - 1);
  const i   = Math.min(Math.floor(seg), THERMAL_STOPS.length - 2);
  const f   = seg - i;
  return THERMAL_STOPS[i].map((v, k) =>
    Math.round(v + f * (THERMAL_STOPS[i + 1][k] - v)),
  );
}

/**
 * Render the distance field onto a canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Float32Array}            distF32  — one f32 per pixel (already decoded)
 * @param {number}                  W
 * @param {number}                  H
 */
export function drawDistField(ctx, distF32, W, H) {
  let maxD = 0;
  for (let i = 0; i < W * H; i++) {
    if (distF32[i] > maxD) maxD = distF32[i];
  }

  const id = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const t        = maxD > 0 ? distF32[i] / maxD : 0;
    const [r, g, b] = thermalColor(t);
    id.data[i * 4]     = r;
    id.data[i * 4 + 1] = g;
    id.data[i * 4 + 2] = b;
    id.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(id, 0, 0);
}

/**
 * Decode a GPU f16 buffer (returned as Uint8Array bytes) into Float32Array.
 * Needed only for display — the actual GPU computation stays in f16.
 *
 * @param {Uint8Array} bytes   — raw bytes from stagingBuf.getMappedRange()
 * @param {number}     count   — number of f16 values (W * H)
 * @returns {Float32Array}
 */
export function decodeF16(bytes, count) {
  const out = new Float32Array(count);
  const dv  = new DataView(bytes.buffer ?? bytes);
  for (let i = 0; i < count; i++) {
    const h    = dv.getUint16(i * 2, true);
    const sign = (h >> 15) ? -1 : 1;
    const exp  = (h >> 10) & 0x1F;
    const mant = h & 0x3FF;
    if      (exp === 0)   out[i] = sign * 2 ** -14 * (mant / 1024);
    else if (exp === 31)  out[i] = mant ? NaN : sign * Infinity;
    else                  out[i] = sign * 2 ** (exp - 15) * (1 + mant / 1024);
  }
  return out;
}
