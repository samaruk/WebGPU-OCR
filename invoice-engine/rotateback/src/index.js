/**
 * invoice-engine - GRIDLIFT + InvoiceForensics + PaddleOCR-VL sidecar.
 *
 *                  INPUT
 *                    |
 *             image normalisation
 *                    |
 *          +---------------------+
 *          |      GRIDLIFT       |   15 stages, 01-12 on the GPU
 *          +----------+----------+
 *                     |
 *              geometry graph
 *                     |
 *          +----------+----------+
 *          |                     |
 *      OCR engine            Forensics
 *          |                     |
 *          +----------+----------+
 *                     |
 *              confidence fusion
 *                     |
 *              conf < threshold ? --> PaddleOCR-VL (ROIs only)
 *                     |
 *              evidence fusion
 *                     |
 *              invoice structure
 *                     |
 *              validation engine
 *                     |
 *              FINAL JSON
 */

import { Gridlift } from './gridlift/index.js';
import { analyseInvoice } from './forensics/index.js';
import { EscalationController, DEFAULT_BUDGET } from './ocr/escalation.js';
import { NullOcrProvider } from './ocr/provider.js';
import { RectifyingCropper } from './gridlift/rectify/warp.js';

export { Gridlift } from './gridlift/index.js';
export * from './forensics/index.js';
export { OcrProvider, NullOcrProvider, RasterOcrProvider, RoiCropper } from './ocr/provider.js';
export { PaddleOcrVLSidecar } from './ocr/paddleSidecar.js';
export { EscalationController, DEFAULT_BUDGET, baseRegionsFor } from './ocr/escalation.js';
export { RectifyingCropper, warpCropToCanvas } from './gridlift/rectify/warp.js';
export { DEFAULT_CONFIG, resolveConfig } from './gridlift/config.js';

export class InvoiceEngine {
  constructor({ gridlift, baseOcr = new NullOcrProvider(), sidecar = null, budget = {}, forensics = {} } = {}) {
    this.gridlift = gridlift;
    this.baseOcr = baseOcr;
    this.sidecar = sidecar;
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    this.forensicsOptions = forensics;
  }

  /**
   * @param {object} opts
   * @param {object} [opts.config]   GRIDLIFT config overrides
   * @param {import('./ocr/provider.js').OcrProvider} [opts.baseOcr]
   * @param {import('./ocr/paddleSidecar.js').PaddleOcrVLSidecar} [opts.sidecar]
   */
  static async create(opts = {}) {
    const gridlift = await Gridlift.create(opts.config ?? {});
    return new InvoiceEngine({ ...opts, gridlift });
  }

  destroy() {
    this.gridlift.destroy();
  }

  /**
   * Full run: geometry -> text -> semantics -> validation, with confidence-
   * gated escalation in between.
   *
   * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas} source
   */
  async process(source, options = {}) {
    const t0 = performance.now();
    const { geometry, ctx, rectification } = await this.gridlift.analyse(source, options);

    // When the page was rectified, geometry lives in the rectified frame but
    // the pixels worth reading are still in the original. Each ROI is warped on
    // its way to the recogniser rather than the whole page being rewritten.
    const applied = geometry.image.rectification?.applied && rectification?.ok;
    const cropper = applied ? new RectifyingCropper(rectification.Hinv) : null;

    const controller = new EscalationController({
      baseOcr: this.baseOcr,
      sidecar: this.sidecar,
      budget: this.budget,
      analyse: (g, c, ocr) => analyseInvoice(g, c, ocr, this.forensicsOptions),
    });

    const result = await controller.run(source, geometry, ctx, { cropper });

    return {
      invoice: result.invoice,
      confidence: result.confidence,
      geometry,
      regions: result.regions,
      tables: result.tables,
      primaryTableIndex: result.primaryTableIndex,
      escalations: result.escalations,
      escalation: result.escalation,
      rectification: geometry.image.rectification ?? { applied: false },
      ocr: { engine: result.ocr?.engine, boxes: result.ocr?.boxes?.length ?? 0 },
      warnings: geometry.warnings,
      timings: {
        ...geometry.timings,
        wallMs: +(performance.now() - t0).toFixed(2),
      },
    };
  }

  /** Geometry only - no OCR, no sidecar. Useful as a fast pre-pass. */
  async geometryOnly(source, options = {}) {
    const { geometry, ctx } = await this.gridlift.analyse(source, options);
    const forensics = analyseInvoice(geometry, ctx, null, this.forensicsOptions);
    return { geometry, forensics };
  }
}

/**
 * Load an image at full resolution.
 *
 * `imageOrientation: 'from-image'` is passed explicitly and deliberately. Phone
 * photos record their rotation in EXIF rather than in the pixels, browsers have
 * disagreed about whether `createImageBitmap` honours it, and the default has
 * changed. Relying on it is how a portrait invoice arrives as a landscape
 * bitmap - a whole 90-degree rotation that no amount of geometry analysis
 * should have had to discover.
 */
export async function loadImage(input) {
  const opts = { imageOrientation: 'from-image' };
  if (typeof input === 'string') {
    const res = await fetch(input);
    return createImageBitmap(await res.blob(), opts);
  }
  if (input instanceof Blob) return createImageBitmap(input, opts);
  if (typeof ImageBitmap !== 'undefined' && input instanceof ImageBitmap) return input;
  return createImageBitmap(input, opts);
}
