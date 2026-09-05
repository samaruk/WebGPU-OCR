/**
 * OCR provider contract.
 *
 * The whole point of GRIDLIFT is that OCR is never asked to discover layout.
 * A provider therefore receives *rectangles* and returns text for them - it is
 * never handed the page and asked what is on it.
 *
 * All coordinates crossing this boundary are in SOURCE image pixels, because
 * crops must come from the full-resolution original; the working resolution
 * exists for geometry, not for reading 8pt type.
 *
 * @typedef {{x:number,y:number,w:number,h:number}} Rect
 * @typedef {{x:number,y:number,w:number,h:number,text:string,confidence:number}} OcrBox
 * @typedef {{boxes: OcrBox[], engine?: string, ms?: number}} OcrResult
 *
 * When the page was rectified, "SOURCE coordinates" means the *rectified* page,
 * because that is the frame the geometry lives in. The crop itself still comes
 * from the untouched original - a `RectifyingCropper` warps each ROI on its way
 * out, so the recogniser sees straight text and the original is never rewritten.
 */

export class OcrProvider {
  /** @returns {string} */
  get name() { return 'abstract'; }

  /**
   * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas} source full-res page
   * @param {Rect[]} rects regions to read
   * @returns {Promise<OcrResult>} boxes in SOURCE coordinates
   */
  async recognize(source, rects) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.name}: recognize() not implemented`);
  }

  async dispose() {}
}

/** Returns nothing. Lets the whole stack run geometry-only. */
export class NullOcrProvider extends OcrProvider {
  get name() { return 'null'; }
  async recognize() { return { boxes: [], engine: 'null' }; }
}

/* ------------------------------------------------------------------ *
 * Cropping
 * ------------------------------------------------------------------ */

/**
 * Crop rectangles out of the source image, with padding and optional upscaling.
 *
 * Upscaling matters: a 9pt line in a 200dpi scan is ~12px tall, and most
 * recognisers are trained near 32px. Scaling the *crop* is cheap; scaling the
 * page is not.
 */
export class RoiCropper {
  constructor({ pad = 6, minHeight = 32, maxScale = 4, background = '#ffffff' } = {}) {
    this.pad = pad;
    this.minHeight = minHeight;
    this.maxScale = maxScale;
    this.background = background;
  }

  /** @returns {{canvas: HTMLCanvasElement|OffscreenCanvas, rect: Rect, scale: number}} */
  crop(source, rect) {
    const sw = source.width ?? source.codedWidth;
    const sh = source.height ?? source.codedHeight;
    const x = Math.max(0, Math.floor(rect.x - this.pad));
    const y = Math.max(0, Math.floor(rect.y - this.pad));
    const w = Math.min(sw - x, Math.ceil(rect.w + this.pad * 2));
    const h = Math.min(sh - y, Math.ceil(rect.h + this.pad * 2));
    if (w <= 0 || h <= 0) return null;

    const scale = Math.min(this.maxScale, Math.max(1, this.minHeight / Math.max(1, h)));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);

    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(cw, ch)
      : Object.assign(document.createElement('canvas'), { width: cw, height: ch });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, x, y, w, h, 0, 0, cw, ch);
    return { canvas, rect: { x, y, w, h }, scale };
  }

  /** Map a box in crop coordinates back to source coordinates. */
  static toSource(box, crop) {
    return {
      ...box,
      x: crop.rect.x + box.x / crop.scale,
      y: crop.rect.y + box.y / crop.scale,
      w: box.w / crop.scale,
      h: box.h / crop.scale,
    };
  }

  static async toBlob(canvas, type = 'image/png', quality = 0.92) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
    return new Promise((res) => canvas.toBlob(res, type, quality));
  }

  static async toDataUrl(canvas, type = 'image/png') {
    if (canvas.toDataURL) return canvas.toDataURL(type);
    const blob = await RoiCropper.toBlob(canvas, type);
    return new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    });
  }
}

/**
 * Adapter shape for an existing raster OCR engine (Tesseract.js, a WASM build,
 * or the .NET host's own engine reached over the bridge). Supply `engineFn`
 * that takes a canvas and returns word boxes in crop coordinates.
 */
export class RasterOcrProvider extends OcrProvider {
  constructor(engineFn, { cropper = new RoiCropper(), label = 'raster', concurrency = 2 } = {}) {
    super();
    this.engineFn = engineFn;
    this.cropper = cropper;
    this.label = label;
    this.concurrency = concurrency;
  }

  get name() { return this.label; }

  async recognize(source, rects, { cropper } = {}) {
    const t0 = Date.now();
    const cut = cropper ?? this.cropper;
    const boxes = [];
    const queue = [...rects];
    const workers = Array.from({ length: Math.min(this.concurrency, queue.length || 1) }, async () => {
      while (queue.length) {
        const rect = queue.shift();
        const crop = cut.crop(source, rect);
        if (!crop) continue;
        const words = await this.engineFn(crop.canvas, rect);
        for (const wbox of words ?? []) boxes.push(RoiCropper.toSource(wbox, crop));
      }
    });
    await Promise.all(workers);
    return { boxes, engine: this.label, ms: Date.now() - t0 };
  }
}
