/**
 * Tesseract.js adapter - the cheap base OCR pass.
 *
 * Loaded from a CDN on demand so nothing here is a hard dependency: the engine
 * runs geometry-only without it, and a host with its own recogniser (including
 * a .NET engine reached over the bridge) implements the same `OcrProvider`
 * contract instead.
 *
 * Crucially it is fed *rectangles*, never the page. Tesseract's own page
 * segmentation is exactly the layout-discovery step GRIDLIFT replaces, so it is
 * pinned to single-line/single-block mode per crop.
 */

import { RasterOcrProvider, RoiCropper } from './provider.js';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';

let loading = null;

async function loadTesseract(src = CDN) {
  if (globalThis.Tesseract) return globalThis.Tesseract;
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(globalThis.Tesseract);
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.append(s);
  });
  return loading;
}

/**
 * @param {{lang?:string, psm?:number, cdn?:string, whitelist?:string|null,
 *          concurrency?:number, cropper?:RoiCropper}} opts
 * @returns {Promise<RasterOcrProvider>}
 */
export async function createTesseractProvider({
  lang = 'eng',
  psm = 6,              // "assume a single uniform block of text"
  cdn = CDN,
  whitelist = null,
  concurrency = 2,
  cropper = new RoiCropper({ pad: 4, minHeight: 34, maxScale: 4 }),
} = {}) {
  const T = await loadTesseract(cdn);
  const worker = await T.createWorker(lang);
  await worker.setParameters({
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: '1',
    ...(whitelist ? { tessedit_char_whitelist: whitelist } : {}),
  });

  const provider = new RasterOcrProvider(
    async (canvas) => {
      const { data } = await worker.recognize(canvas);
      return (data.words ?? [])
        .filter((w) => (w.text ?? '').trim())
        .map((w) => ({
          x: w.bbox.x0,
          y: w.bbox.y0,
          w: w.bbox.x1 - w.bbox.x0,
          h: w.bbox.y1 - w.bbox.y0,
          text: w.text.trim(),
          confidence: (w.confidence ?? 60) / 100,
        }));
    },
    { cropper, label: `tesseract:${lang}`, concurrency },
  );

  provider.dispose = async () => { await worker.terminate(); };
  return provider;
}

/**
 * A digits-only provider for numeric columns. Restricting the character set
 * roughly halves the confusion set (O/0, l/1, S/5) on the very cells where a
 * misread is most expensive, which is why the escalation controller can ask for
 * a second opinion on a money cell without paying for the VL model.
 */
export const createNumericTesseractProvider = (opts = {}) =>
  createTesseractProvider({
    psm: 7, // single line
    whitelist: '0123456789.,-()%',
    ...opts,
  });
