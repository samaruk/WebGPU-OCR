
/**
 * Tesseract.js OCR wrapper.
 * Takes a canvas (containing the segmented binary image) and returns
 * { text, confidence } from Tesseract.
 */
export class Recognizer {
  constructor() { this._worker = null; }

  async init(onProgress) {
    this._worker = await Tesseract.createWorker('eng', 1, {
      logger: m => onProgress?.(m),
    });
    await this._worker.setParameters({
      tessedit_pageseg_mode: '6',   // uniform block of text
      tessedit_char_whitelist: '',  // all chars
    });
  }

  async recognize(canvas) {
    if (!this._worker) throw new Error('Recognizer not initialised.');
    const { data } = await this._worker.recognize(canvas);
    return {
      text:       data.text.trim(),
      confidence: Math.round(data.confidence),
      words:      data.words ?? [],
    };
  }

  async terminate() {
    if (this._worker) { await this._worker.terminate(); this._worker = null; }
  }
}
