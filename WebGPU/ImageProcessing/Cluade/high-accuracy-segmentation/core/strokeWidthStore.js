/**
 * core/strokeWidthStore.js
 * Pipeline-global accessor for meanStrokeWidth and the SWT texture.
 * Written once by Stage 07 (meanStrokeExtract); read by stages 09, 10, 13, 14, 15, 16.
 */
export class StrokeWidthStore {
  constructor() {
    this.meanStrokeWidth = null;   // scalar px
    this.strokeWidthStdDev = null; // scalar px
    this.swtTexture = null;        // GPUTexture (r32float)
    this.swtQuality = null;        // 0..1 reliability score
    this.fallbackMode = false;     // true if SWT was unreliable
  }

  write({ meanStrokeWidth, strokeWidthStdDev, swtTexture, swtQuality, fallbackMode }) {
    this.meanStrokeWidth   = meanStrokeWidth;
    this.strokeWidthStdDev = strokeWidthStdDev;
    this.swtTexture        = swtTexture;
    this.swtQuality        = swtQuality;
    this.fallbackMode      = fallbackMode;
  }

  /** Returns meanStrokeWidth or a safe DPI-based fallback. */
  get(fallback = 8) {
    return this.meanStrokeWidth ?? fallback;
  }

  isReady() { return this.meanStrokeWidth !== null; }
}
