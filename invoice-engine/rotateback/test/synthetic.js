/**
 * Synthetic invoice renderer.
 *
 * Produces exactly what stages 01-12 hand to the CPU - a packed mask buffer and
 * a component table - without needing a GPU. That lets stages 13-15 and the
 * whole of InvoiceForensics be tested deterministically, including the cases
 * that are awkward to photograph: missing borders, broken borders, decorative
 * borders, wrapped description rows.
 *
 * Glyphs are rendered as individual blocks so word grouping and line clustering
 * have real work to do, exactly as they would with CCA output.
 */

import { LANE } from '../src/gridlift/pipeline.js';

const setLane = (packed, i, lane, v) => {
  packed[i] = (packed[i] & ~(0xff << lane)) | ((v & 0xff) << lane);
};

export class SyntheticPage {
  constructor(width = 900, height = 1200) {
    this.width = width;
    this.height = height;
    this.packed = new Uint32Array(width * height);
    this.components = [];
    this.words = [];
    this._id = 0;
  }

  #fillRect(x0, y0, w, h, lane, value = 255) {
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= this.height) continue;
      const row = y * this.width;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= this.width) continue;
        setLane(this.packed, row + x, lane, value);
      }
    }
  }

  #glyph(x, y, w, h) {
    this.#fillRect(x, y, w, h, LANE.INK);
    this.#fillRect(x, y, w, h, LANE.OCR);
    const c = {
      id: this._id++,
      x, y, w, h, x1: x + w - 1, y1: y + h - 1,
      cx: x + w / 2, cy: y + h / 2,
      area: w * h,
      density: 1,
      aspect: w / h,
      strokeRatio: 0,
      inkSum: w * h,
      root: 0,
      isText: true,
    };
    this.components.push(c);
    return c;
  }

  /**
   * @param {string} text
   * @param {{x:number,y:number,size?:number,align?:'left'|'right'|'center'}} opts
   * @returns {{x:number,y:number,w:number,h:number,text:string}} word-run box
   */
  text(text, { x, y, size = 14, align = 'left' } = {}) {
    const cw = Math.round(size * 0.55);
    const gap = Math.max(1, Math.round(size * 0.18));
    const space = Math.round(size * 0.6);
    const advance = (ch) => (ch === ' ' ? space : cw + gap);
    const total = [...text].reduce((s, ch) => s + advance(ch), 0) - gap;

    let cursor = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    const startX = cursor;

    // Split into words so ground-truth OCR boxes match what groupWords sees.
    let wordStart = cursor;
    let wordText = '';
    const flush = (endX) => {
      if (!wordText) return;
      const box = { x: wordStart, y, w: endX - wordStart, h: size, text: wordText };
      this.words.push(box);
      wordText = '';
    };

    // Real vertical metrics, because several estimators depend on them: the
    // skew histogram anchors on baselines, and the up/down polarity test reads
    // the asymmetry between ascender and descender mass. A fixture where every
    // glyph is one rectangle would let both of those pass for the wrong reason.
    const baseline = y + size;
    const XHEIGHT = 'acemnorsuvwxz';
    const DESCENDER = 'gjpqy';
    for (const ch of text) {
      if (ch === ' ') {
        flush(cursor - gap);
        cursor += space;
        wordStart = cursor;
        continue;
      }
      let up = size;                                  // caps, digits, ascenders
      let down = 0;
      if (DESCENDER.includes(ch)) { up = Math.round(size * 0.7); down = Math.round(size * 0.26); }
      else if (XHEIGHT.includes(ch)) { up = Math.round(size * 0.7); }
      else if (ch === '.' || ch === ',') { up = 3; down = ch === ',' ? 2 : 0; }
      this.#glyph(cursor, baseline - up, cw, up + down);
      wordText += ch;
      cursor += advance(ch);
    }
    flush(cursor - gap);

    return { x: startX, y, w: total, h: size, text };
  }

  hRule(x0, x1, y, { thickness = 2, lane = LANE.H } = {}) {
    this.#fillRect(x0, y, x1 - x0 + 1, thickness, lane);
    this.#fillRect(x0, y, x1 - x0 + 1, thickness, LANE.INK);
  }

  vRule(y0, y1, x, { thickness = 2, lane = LANE.V } = {}) {
    this.#fillRect(x, y0, thickness, y1 - y0 + 1, lane);
    this.#fillRect(x, y0, thickness, y1 - y0 + 1, LANE.INK);
  }

  /** Ground-truth OCR result in source coordinates (scale = 1 here). */
  ocr(confidence = 0.93) {
    return {
      boxes: this.words.map((w) => ({ ...w, confidence })),
      engine: 'synthetic',
    };
  }

  raw() {
    return {
      width: this.width,
      height: this.height,
      sourceWidth: this.width,
      sourceHeight: this.height,
      scale: 1,
      packed: this.packed,
      // Stand-in for stage 11's compacted component table.
      components: this.components,
      componentCount: this.components.length,
      componentCapacity: 65536,
      componentStride: 8,
      angleHistogram: (() => {
        const h = new Uint32Array(180);
        h[90] = 1000; // perfectly square page
        h[89] = 200; h[91] = 200;
        h[0] = 800;
        return h;
      })(),
      stages: [],
      gpuMs: 0,
      overflow: false,
    };
  }
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const ITEMS = [
  ['1', 'Napa 500mg', '10', '5.00', '50.00'],
  ['2', 'Paracetamol BP', '5', '8.00', '40.00'],
  ['3', 'Syringe 5ml', '3', '15.00', '45.00'],
  ['4', 'Bandage Roll', '2', '12.50', '25.00'],
];

const COLS = [
  { x: 70, align: 'left' },    // SL
  { x: 120, align: 'left' },   // description
  { x: 520, align: 'right' },  // qty
  { x: 650, align: 'right' },  // rate
  { x: 800, align: 'right' },  // amount
];

const HEADERS = ['SL', 'Description', 'Qty', 'Rate', 'Amount'];

function header(page) {
  page.text('ABC PHARMACY LTD', { x: 450, y: 40, size: 22, align: 'center' });
  page.text('TAX INVOICE', { x: 450, y: 80, size: 18, align: 'center' });
  page.text('Invoice No: INV-2026-0042', { x: 70, y: 130, size: 13 });
  page.text('Date: 12/03/2026', { x: 70, y: 152, size: 13 });
  page.text('Bill To: Rahim Traders', { x: 70, y: 200, size: 13 });
  page.text('123 Market Road, Dhaka', { x: 70, y: 222, size: 13 });
}

function summary(page, y) {
  page.text('Subtotal', { x: 650, y, size: 14, align: 'right' });
  page.text('160.00', { x: 860, y, size: 14, align: 'right' });
  page.text('VAT 15%', { x: 650, y: y + 30, size: 14, align: 'right' });
  page.text('24.00', { x: 860, y: y + 30, size: 14, align: 'right' });
  page.text('Grand Total', { x: 650, y: y + 60, size: 14, align: 'right' });
  page.text('184.00', { x: 860, y: y + 60, size: 14, align: 'right' });
  page.text('Thank you for your business', { x: 450, y: y + 140, size: 12, align: 'center' });
}

function tableBody(page, y0, rowPitch = 34) {
  const rows = [];
  HEADERS.forEach((h, i) => page.text(h, { x: COLS[i].x, y: y0, size: 14, align: COLS[i].align }));
  rows.push(y0);
  ITEMS.forEach((item, r) => {
    const y = y0 + rowPitch * (r + 1);
    item.forEach((cell, i) => page.text(cell, { x: COLS[i].x, y, size: 14, align: COLS[i].align }));
    rows.push(y);
  });
  return rows;
}

/** Fully ruled table. */
export function borderedInvoice() {
  const page = new SyntheticPage();
  header(page);
  const y0 = 300;
  const rows = tableBody(page, y0);
  const bottom = rows[rows.length - 1] + 34;
  for (const y of [y0 - 10, ...rows.slice(1).map((r) => r - 10), bottom]) {
    page.hRule(60, 870, y);
  }
  for (const x of [60, 112, 470, 560, 700, 870]) {
    page.vRule(y0 - 10, bottom + 1, x);
  }
  summary(page, bottom + 50);
  return page;
}

/** No rules at all - alignment is the only evidence. */
export function borderlessInvoice() {
  const page = new SyntheticPage();
  header(page);
  const rows = tableBody(page, 300);
  summary(page, rows[rows.length - 1] + 90);
  return page;
}

/** Rules present but shattered into fragments, as on a bad fax/scan. */
export function brokenBorderInvoice() {
  const page = new SyntheticPage();
  header(page);
  const y0 = 300;
  const rows = tableBody(page, y0);
  const bottom = rows[rows.length - 1] + 34;
  for (const y of [y0 - 10, rows[1] - 10, bottom]) {
    // deliberate gaps
    page.hRule(60, 300, y);
    page.hRule(340, 560, y);
    page.hRule(600, 870, y);
  }
  page.vRule(y0 - 10, bottom, 470);
  page.vRule(y0 - 10, bottom, 700);
  summary(page, bottom + 50);
  return page;
}

/** A decorative banner that must not be read as a table. */
export function decorativeBannerPage() {
  const page = new SyntheticPage(900, 500);
  page.hRule(60, 870, 60, { thickness: 5 });
  page.hRule(60, 870, 68, { thickness: 5 });
  page.text('INVOICE', { x: 450, y: 100, size: 26, align: 'center' });
  page.hRule(60, 870, 160, { thickness: 5 });
  page.hRule(60, 870, 168, { thickness: 5 });
  return page;
}

/** Wrapped descriptions and orphaned numbers - the row-merge case. */
export function wrappedRowInvoice() {
  const page = new SyntheticPage();
  header(page);
  const y0 = 300;
  HEADERS.forEach((h, i) => page.text(h, { x: COLS[i].x, y: y0, size: 14, align: COLS[i].align }));

  // Item 1: description wraps onto a second line, values on the first.
  page.text('1', { x: COLS[0].x, y: 340, size: 14 });
  page.text('Amoxicillin Capsule', { x: COLS[1].x, y: 340, size: 14 });
  page.text('10', { x: COLS[2].x, y: 340, size: 14, align: 'right' });
  page.text('5.00', { x: COLS[3].x, y: 340, size: 14, align: 'right' });
  page.text('50.00', { x: COLS[4].x, y: 340, size: 14, align: 'right' });
  page.text('250mg blister pack of 10', { x: COLS[1].x + 12, y: 366, size: 12 });

  // Item 2: description on two lines, values only on the *third* line.
  page.text('2', { x: COLS[0].x, y: 404, size: 14 });
  page.text('Ceftriaxone Injection', { x: COLS[1].x, y: 404, size: 14 });
  page.text('with sterile water ampoule', { x: COLS[1].x + 12, y: 430, size: 12 });
  page.text('4', { x: COLS[2].x, y: 456, size: 14, align: 'right' });
  page.text('25.00', { x: COLS[3].x, y: 456, size: 14, align: 'right' });
  page.text('100.00', { x: COLS[4].x, y: 456, size: 14, align: 'right' });

  page.text('Subtotal', { x: 650, y: 540, size: 14, align: 'right' });
  page.text('150.00', { x: 860, y: 540, size: 14, align: 'right' });
  page.text('Grand Total', { x: 650, y: 570, size: 14, align: 'right' });
  page.text('150.00', { x: 860, y: 570, size: 14, align: 'right' });
  return page;
}

/** No header row at all - only arithmetic can type the columns. */
export function headerlessInvoice() {
  const page = new SyntheticPage();
  header(page);
  const y0 = 300;
  ITEMS.forEach((item, r) => {
    const y = y0 + 34 * r;
    item.forEach((cell, i) => page.text(cell, { x: COLS[i].x, y, size: 14, align: COLS[i].align }));
  });
  summary(page, y0 + 34 * ITEMS.length + 50);
  return page;
}
