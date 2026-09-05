/**
 * ROI escalation controller.
 *
 *                 Invoice
 *                    |
 *                GRIDLIFT
 *          ______/        \______
 *      conf > accept        conf < accept
 *          |                    |
 *        accept            InvoiceForensics
 *                           /        \
 *                      resolved    unresolved
 *                          |            |
 *                       accept    PaddleOCR-VL  (only the ROIs, never the page)
 *
 * The budget is the design. A 12 MP page through a vision-language model costs
 * seconds and real money; six 200x40 cells cost milliseconds. Escalation is
 * therefore rectangle-addressed, priority-ordered and hard-capped in count,
 * pixels and wall-clock, and it stops the moment confidence clears the bar.
 */

import { NullOcrProvider } from './provider.js';

export const DEFAULT_BUDGET = {
  /** Stop escalating once fused confidence reaches this. */
  acceptConfidence: 0.9,
  /** Never send more than this many ROIs to the sidecar. */
  maxRois: 12,
  /** Cumulative source-pixel cap across all escalated crops. */
  maxPixels: 4_000_000,
  /** Wall-clock cap for the whole escalation phase. */
  maxMs: 15000,
  /** Escalate in waves so confidence can be re-checked between them. */
  waveSize: 4,
  /** Fall back to a whole-band structure parse when cells do not settle it. */
  allowStructureParse: true,
};

export class EscalationController {
  /**
   * @param {object} deps
   * @param {import('./provider.js').OcrProvider} deps.baseOcr   cheap engine (Tesseract, host engine)
   * @param {import('./paddleSidecar.js').PaddleOcrVLSidecar} deps.sidecar
   * @param {(geometry, ctx, ocr) => object} deps.analyse        forensics entry point
   */
  constructor({ baseOcr = new NullOcrProvider(), sidecar = null, analyse, budget = {} } = {}) {
    this.baseOcr = baseOcr;
    this.sidecar = sidecar;
    this.analyse = analyse;
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    this.trace = [];
  }

  /**
   * @param {ImageBitmap|HTMLCanvasElement} source full-resolution page
   * @param {object} geometry GRIDLIFT geometry graph
   * @param {object} ctx      GRIDLIFT run context
   */
  async run(source, geometry, ctx) {
    const t0 = Date.now();
    this.trace = [];
    const budget = this.budget;
    const spent = { rois: 0, pixels: 0 };

    // --- gate 1: geometry alone ------------------------------------------
    this.trace.push({ step: 'gridlift', confidence: geometry.confidence, tables: geometry.tables.length });

    // --- base OCR over the regions geometry already found -----------------
    const baseRects = baseRegionsFor(geometry);
    let ocr = { boxes: [], engine: 'none' };
    if (baseRects.length && this.baseOcr && !(this.baseOcr instanceof NullOcrProvider)) {
      ocr = await this.baseOcr.recognize(source, baseRects);
      this.trace.push({ step: 'base-ocr', engine: ocr.engine, boxes: ocr.boxes.length, ms: ocr.ms });
    }

    let result = this.analyse(geometry, ctx, ocr.boxes.length ? ocr : null);
    this.trace.push({ step: 'forensics', confidence: result.confidence, escalations: result.escalations.length });

    // --- gate 2: good enough? --------------------------------------------
    if (result.confidence >= budget.acceptConfidence || !this.sidecar) {
      return this.#finish(result, ocr, spent, t0, result.confidence >= budget.acceptConfidence ? 'accepted' : 'no-sidecar');
    }

    // --- gate 3: escalate ROIs in priority waves --------------------------
    const pending = dedupeRois(result.escalations);
    while (
      pending.length &&
      spent.rois < budget.maxRois &&
      spent.pixels < budget.maxPixels &&
      Date.now() - t0 < budget.maxMs
    ) {
      const wave = [];
      while (
        wave.length < budget.waveSize &&
        pending.length &&
        spent.rois + wave.length < budget.maxRois
      ) {
        const roi = pending.shift();
        const px = roi.sourceBounds.w * roi.sourceBounds.h;
        if (spent.pixels + px > budget.maxPixels) continue;
        spent.pixels += px;
        wave.push(roi);
      }
      if (!wave.length) break;

      const res = await this.sidecar.recognize(source, wave.map((r) => r.sourceBounds), {
        task: 'ocr',
        meta: { kinds: wave.map((r) => r.kind) },
      });
      spent.rois += wave.length;
      ocr = mergeOcr(ocr, res);
      this.trace.push({
        step: 'escalate',
        rois: wave.length,
        kinds: wave.map((r) => `${r.kind}${r.row != null ? `#${r.row}` : ''}`),
        boxes: res.boxes.length,
        ms: res.ms,
      });

      result = this.analyse(geometry, ctx, ocr);
      this.trace.push({ step: 'forensics', confidence: result.confidence });
      if (result.confidence >= budget.acceptConfidence) {
        return this.#finish(result, ocr, spent, t0, 'accepted-after-escalation');
      }
      // Re-plan: solving one cell can change which others matter.
      const fresh = dedupeRois(result.escalations).filter(
        (r) => !wave.some((w) => sameRoi(w, r)),
      );
      pending.length = 0;
      pending.push(...fresh);
    }

    // --- gate 4: last resort, structure-parse the table band --------------
    if (
      budget.allowStructureParse &&
      this.sidecar.parseStructure &&
      Date.now() - t0 < budget.maxMs &&
      result.confidence < budget.acceptConfidence
    ) {
      const table = geometry.tables[result.primaryTableIndex ?? 0];
      if (table) {
        const rect = scaleRect(table.bounds, geometry.image.scale);
        if (rect.w * rect.h + spent.pixels <= budget.maxPixels * 2) {
          const parsed = await this.sidecar.parseStructure(source, rect);
          spent.pixels += rect.w * rect.h;
          this.trace.push({ step: 'structure-parse', confidence: parsed?.confidence ?? 0 });
          if (parsed?.boxes?.length) {
            ocr = mergeOcr(ocr, { boxes: parsed.boxes, engine: 'paddleocr-vl:structure' });
            result = this.analyse(geometry, ctx, ocr);
            result.sidecarStructure = parsed.structure ?? null;
            this.trace.push({ step: 'forensics', confidence: result.confidence });
          }
        }
      }
    }

    return this.#finish(result, ocr, spent, t0, 'budget-exhausted');
  }

  #finish(result, ocr, spent, t0, outcome) {
    return {
      ...result,
      ocr,
      escalation: {
        outcome,
        roisEscalated: spent.rois,
        pixelsEscalated: spent.pixels,
        ms: Date.now() - t0,
        trace: this.trace,
        sidecarStats: this.sidecar?.stats ?? null,
      },
    };
  }
}

/**
 * What the cheap engine reads first: every cell of every table, plus the text
 * lines outside the tables (header, addresses, summary ladder). Still not the
 * page - overlapping crops of known rectangles, which is what keeps the base
 * pass fast too.
 */
export function baseRegionsFor(geometry, { mergeLines = true } = {}) {
  const scale = geometry.image.scale;
  const rects = [];
  const tableBands = [];

  for (const t of geometry.tables) {
    tableBands.push(t.bounds);
    for (const cell of t.cells) {
      if (cell.hasText || cell.inkRatio > 0.01) rects.push(cell.sourceBounds);
    }
  }
  const inTable = (L) =>
    tableBands.some((b) => L.y + L.h > b.y && L.y < b.y + b.h && L.x + L.w > b.x && L.x < b.x + b.w);

  for (const L of geometry.textLines) {
    if (inTable(L)) continue;
    rects.push(mergeLines ? L.sourceBounds : scaleRect(L, scale));
  }
  return rects;
}

function mergeOcr(a, b) {
  // Later sources win where they overlap: the sidecar is only ever called on
  // regions the cheap pass could not settle.
  const overlaps = (p, q) =>
    p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y;
  const kept = a.boxes.filter((box) => !b.boxes.some((nb) => overlaps(box, nb)));
  return {
    boxes: [...kept, ...b.boxes],
    engine: `${a.engine}+${b.engine}`,
    ms: (a.ms ?? 0) + (b.ms ?? 0),
  };
}

function dedupeRois(escalations) {
  const out = [];
  for (const e of escalations) {
    if (!e.sourceBounds || e.sourceBounds.w <= 0 || e.sourceBounds.h <= 0) continue;
    if (out.some((o) => sameRoi(o, e))) continue;
    out.push(e);
  }
  return out;
}

const sameRoi = (a, b) =>
  a.kind === b.kind && a.table === b.table && a.row === b.row && a.col === b.col;

const scaleRect = (b, scale) => ({
  x: Math.round(b.x / scale),
  y: Math.round(b.y / scale),
  w: Math.round(b.w / scale),
  h: Math.round(b.h / scale),
});
