/**
 * PaddleOCR-VL sidecar client.
 *
 * The model runs *outside* the application - a separate Python process behind
 * HTTP (or gRPC-web). Nothing about Python, CUDA or PaddlePaddle leaks into the
 * host application; the host speaks JSON to a URL. In the .NET deployment this
 * is exactly the same contract:
 *
 *     InvoiceEngine.exe  --HTTP/gRPC-->  paddleocr-vl service  --JSON-->
 *
 * The sidecar is deliberately *not* the main pipeline. It is asked about the
 * rectangles GRIDLIFT and InvoiceForensics could not settle between them, and
 * it answers with evidence that gets fused, not with a verdict that overrides.
 */

import { OcrProvider, RoiCropper } from './provider.js';

/**
 * Expected service contract (see server-contract.md):
 *
 *   POST {endpoint}/v1/parse
 *   { "task": "ocr" | "structure" | "qa",
 *     "image": "<base64 png, no data: prefix>",
 *     "prompt": "optional instruction for the VL head",
 *     "meta": { "roi": {...}, "role": "QTY", "hint": "..." } }
 *
 *   200 -> { "boxes": [ { "x":0,"y":0,"w":0,"h":0,"text":"","confidence":0.0 } ],
 *            "text": "flat transcription",
 *            "structure": { ... optional table json ... },
 *            "ms": 0 }
 */
export class PaddleOcrVLSidecar extends OcrProvider {
  constructor({
    endpoint = 'http://127.0.0.1:8760',
    apiKey = null,
    timeoutMs = 20000,
    concurrency = 2,
    retries = 1,
    cropper = new RoiCropper({ pad: 8, minHeight: 48, maxScale: 4 }),
    fetchImpl = globalThis.fetch?.bind(globalThis),
  } = {}) {
    super();
    this.endpoint = endpoint.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.concurrency = concurrency;
    this.retries = retries;
    this.cropper = cropper;
    this.fetch = fetchImpl;
    this.stats = { calls: 0, failures: 0, ms: 0, pixels: 0 };
  }

  get name() { return 'paddleocr-vl'; }

  async health() {
    try {
      const res = await this.#call('/health', null, { method: 'GET' });
      return { ok: true, ...res };
    } catch (e) {
      return { ok: false, error: String(e.message ?? e) };
    }
  }

  /**
   * Standard OCR path: crop each rect, transcribe, map boxes back to source
   * coordinates.
   */
  async recognize(source, rects, { task = 'ocr', prompt = null, meta = {}, cropper = null } = {}) {
    const t0 = Date.now();
    const cut = cropper ?? this.cropper;
    const boxes = [];
    const queue = rects.map((r, i) => ({ rect: r, i }));

    const worker = async () => {
      while (queue.length) {
        const { rect } = queue.shift();
        const crop = cut.crop(source, rect);
        if (!crop) continue;
        const image = await toBase64Png(crop.canvas);
        this.stats.pixels += crop.canvas.width * crop.canvas.height;
        let res;
        try {
          res = await this.#call('/v1/parse', {
            task, image, prompt,
            meta: { ...meta, roi: crop.rect, scale: crop.scale },
          });
        } catch (e) {
          this.stats.failures++;
          boxes.push({ ...rect, text: '', confidence: 0, error: String(e.message ?? e) });
          continue;
        }
        for (const b of res.boxes ?? []) {
          boxes.push(RoiCropper.toSource({
            x: b.x ?? 0, y: b.y ?? 0, w: b.w ?? crop.canvas.width, h: b.h ?? crop.canvas.height,
            text: b.text ?? '', confidence: b.confidence ?? 0.5,
          }, crop));
        }
        if (!res.boxes?.length && res.text) {
          boxes.push({ ...rect, text: res.text, confidence: res.confidence ?? 0.5 });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.max(1, Math.min(this.concurrency, rects.length)) }, worker),
    );
    return { boxes, engine: this.name, ms: Date.now() - t0 };
  }

  /**
   * Structure path: hand one difficult region to the VL head and ask for a
   * table rather than words. Used only when GRIDLIFT's own hypotheses are all
   * weak - a wrapped-description block, a merged header, a stamp over a rule.
   */
  async parseStructure(source, rect, { prompt = DEFAULT_STRUCTURE_PROMPT, meta = {}, cropper = null } = {}) {
    const crop = (cropper ?? this.cropper).crop(source, rect);
    if (!crop) return null;
    const image = await toBase64Png(crop.canvas);
    const res = await this.#call('/v1/parse', {
      task: 'structure', image, prompt,
      meta: { ...meta, roi: crop.rect, scale: crop.scale },
    });
    return {
      structure: res.structure ?? null,
      text: res.text ?? '',
      confidence: res.confidence ?? 0.5,
      boxes: (res.boxes ?? []).map((b) => RoiCropper.toSource(b, crop)),
      roi: crop.rect,
    };
  }

  /** Targeted question about one cell ("is this 50.00 or 5000?"). */
  async ask(source, rect, question, meta = {}) {
    const crop = this.cropper.crop(source, rect);
    if (!crop) return null;
    const image = await toBase64Png(crop.canvas);
    const res = await this.#call('/v1/parse', {
      task: 'qa', image, prompt: question, meta: { ...meta, roi: crop.rect },
    });
    return { answer: res.text ?? '', confidence: res.confidence ?? 0.5 };
  }

  async #call(path, body, { method = 'POST' } = {}) {
    if (!this.fetch) throw new Error('no fetch implementation available');
    let lastErr;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      const t0 = Date.now();
      try {
        const res = await this.fetch(`${this.endpoint}${path}`, {
          method,
          signal: ctrl.signal,
          headers: {
            'content-type': 'application/json',
            ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        this.stats.calls++;
        this.stats.ms += Date.now() - t0;
        return json;
      } catch (e) {
        lastErr = e;
        // Do not retry a deliberate abort or a 4xx - only transport flakiness.
        if (e.name === 'AbortError' || /\b4\d\d\b/.test(String(e.message))) break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr ?? new Error('sidecar call failed');
  }
}

export const DEFAULT_STRUCTURE_PROMPT =
  'Read this cropped region of a printed invoice. Return the table it contains as ' +
  'rows of cells in reading order. Preserve numbers exactly as printed, including ' +
  'decimal separators and thousands separators. Do not infer or compute values.';

async function toBase64Png(canvas) {
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: 'image/png' })
    : await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}
