/**
 * ROI warping for OCR.
 *
 * The page is never warped at full resolution. Geometry runs on the rectified
 * *working* image (one GPU pass, folded into stage 02 at no extra cost), but
 * the crops handed to a recogniser must come from the untouched full-resolution
 * original - so each ROI is warped on its own, at its own scale, only when it
 * is actually about to be read.
 *
 * On a 12 MP page that is a few hundred thousand pixels of resampling instead
 * of twelve million, and every crop gets the resolution it deserves rather than
 * whatever a single global warp left it with.
 */

import { M } from './linalg.js';

/**
 * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas} source full-res original
 * @param {{x:number,y:number,w:number,h:number}} rect  ROI in RECTIFIED coords
 * @param {Float64Array} Hinv  rectified -> source (from estimateRectification)
 * @param {{scale?:number, pad?:number, background?:string}} opts
 * @returns {{canvas:(HTMLCanvasElement|OffscreenCanvas), scale:number, rect:object}|null}
 */
export function warpCropToCanvas(source, rect, Hinv, { scale = 1, pad = 4, background = '#ffffff' } = {}) {
  const rx = rect.x - pad;
  const ry = rect.y - pad;
  const rw = rect.w + pad * 2;
  const rh = rect.h + pad * 2;
  const outW = Math.max(1, Math.round(rw * scale));
  const outH = Math.max(1, Math.round(rh * scale));

  // Source-space bounding box of the ROI's four corners, so only that patch of
  // the original is pulled into memory.
  const corners = [[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]]
    .map((p) => M.apply(Hinv, p[0], p[1]));
  const sw = source.width ?? source.codedWidth;
  const sh = source.height ?? source.codedHeight;
  const sx0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0]))) - 2);
  const sy0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1]))) - 2);
  const sx1 = Math.min(sw, Math.ceil(Math.max(...corners.map((c) => c[0]))) + 2);
  const sy1 = Math.min(sh, Math.ceil(Math.max(...corners.map((c) => c[1]))) + 2);
  const patchW = sx1 - sx0;
  const patchH = sy1 - sy0;
  if (patchW <= 0 || patchH <= 0) return null;

  const patch = makeCanvas(patchW, patchH);
  const pctx = patch.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(source, sx0, sy0, patchW, patchH, 0, 0, patchW, patchH);
  const src = pctx.getImageData(0, 0, patchW, patchH);

  const out = makeCanvas(outW, outH);
  const octx = out.getContext('2d');
  const dst = octx.createImageData(outW, outH);
  const bg = parseColor(background);

  warpInto(src, dst, {
    Hinv, sx0, sy0, rx, ry, scale, background: bg,
  });

  octx.putImageData(dst, 0, 0);
  return { canvas: out, scale, rect: { x: rx, y: ry, w: rw, h: rh } };
}

/** Bilinear inverse warp of one ROI. */
function warpInto(src, dst, { Hinv, sx0, sy0, rx, ry, scale, background }) {
  const { width: sw, height: sh, data: sd } = src;
  const { width: dw, height: dh, data: dd } = dst;
  const inv = 1 / scale;

  // Homography applied incrementally along each row: the numerators and the
  // denominator are all affine in the output coordinates, so one add per pixel
  // replaces a full matrix multiply.
  for (let oy = 0; oy < dh; oy++) {
    const py = ry + (oy + 0.5) * inv;
    const px0 = rx + 0.5 * inv;
    let nx = Hinv[0] * px0 + Hinv[1] * py + Hinv[2];
    let ny = Hinv[3] * px0 + Hinv[4] * py + Hinv[5];
    let nw = Hinv[6] * px0 + Hinv[7] * py + Hinv[8];
    const dx = Hinv[0] * inv, dy = Hinv[3] * inv, dwv = Hinv[6] * inv;

    for (let ox = 0; ox < dw; ox++, nx += dx, ny += dy, nw += dwv) {
      const o = (oy * dw + ox) * 4;
      if (Math.abs(nw) < 1e-9) { writeBg(dd, o, background); continue; }
      const fx = nx / nw - sx0;
      const fy = ny / nw - sy0;
      if (fx < 0 || fy < 0 || fx > sw - 1 || fy > sh - 1) { writeBg(dd, o, background); continue; }

      const x0 = fx | 0, y0 = fy | 0;
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      const ax = fx - x0, ay = fy - y0;
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay);
      const w01 = (1 - ax) * ay, w11 = ax * ay;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;

      for (let c = 0; c < 3; c++) {
        dd[o + c] =
          sd[i00 + c] * w00 + sd[i10 + c] * w10 + sd[i01 + c] * w01 + sd[i11 + c] * w11;
      }
      dd[o + 3] = 255;
    }
  }
}

const writeBg = (d, o, bg) => { d[o] = bg[0]; d[o + 1] = bg[1]; d[o + 2] = bg[2]; d[o + 3] = 255; };

function parseColor(c) {
  if (Array.isArray(c)) return c;
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c ?? '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * An `OcrProvider`-compatible cropper that rectifies as it crops. Drop it into
 * any provider and the recogniser never sees a skewed line again, while the
 * original stays untouched on disk.
 */
export class RectifyingCropper {
  constructor(Hinv, { pad = 6, minHeight = 34, maxScale = 4, background = '#ffffff' } = {}) {
    this.Hinv = Hinv;
    this.pad = pad;
    this.minHeight = minHeight;
    this.maxScale = maxScale;
    this.background = background;
  }

  crop(source, rect) {
    const scale = Math.min(this.maxScale, Math.max(1, this.minHeight / Math.max(1, rect.h)));
    const res = warpCropToCanvas(source, rect, this.Hinv, {
      scale, pad: this.pad, background: this.background,
    });
    return res && { canvas: res.canvas, rect: res.rect, scale: res.scale };
  }
}

/** Warp a whole image through H (used by tests and by the demo overlay). */
export function warpCrop(source, Hinv, width, height, opts = {}) {
  return warpCropToCanvas(source, { x: 0, y: 0, w: width, h: height }, Hinv, { pad: 0, ...opts });
}
