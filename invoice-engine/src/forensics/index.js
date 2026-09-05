/**
 * InvoiceForensics - "what do these things mean?"
 *
 *   cells -> text -> alignment -> patterns -> invoice semantics
 *         -> logical rows -> typed columns -> invoice fields
 *
 * Consumes GRIDLIFT's geometry graph plus (optionally) OCR text, and returns a
 * structured invoice together with the evidence behind every decision and a
 * list of regions worth escalating to a vision-language model.
 */

import { classifyRegions, REGION } from './regions.js';
import { classifyColumns, ROLE } from './columns.js';
import { reconstructRows } from './rows.js';
import {
  buildLineItems, validateLineArithmetic, extractSummary, reconcile, arithmeticScore,
} from './semantics.js';
import { analyseBorderless, rejectDecorative } from './borderless.js';
import { planColumnMerges, applyColumnMerges } from './mergeColumns.js';
import { fuse, fuseCell, textEvidence, semanticEvidence, DEFAULT_WEIGHTS } from './fusion.js';
import { classifyToken } from './tokens.js';

export { REGION } from './regions.js';
export { ROLE } from './columns.js';
export { TOKEN, classifyToken, parseNumber } from './tokens.js';
export * from './fusion.js';

/**
 * Map OCR boxes (source-image coordinates) onto GRIDLIFT geometry
 * (working-resolution coordinates).
 */
export function attachText(geometry, ocr, { minConfidence = 0 } = {}) {
  const scale = geometry.image.scale;
  const boxes = (ocr?.boxes ?? [])
    .filter((b) => (b.confidence ?? 1) >= minConfidence && (b.text ?? '').trim())
    .map((b) => ({
      x: b.x * scale, y: b.y * scale, w: b.w * scale, h: b.h * scale,
      cx: (b.x + b.w / 2) * scale, cy: (b.y + b.h / 2) * scale,
      text: b.text.trim(),
      confidence: b.confidence ?? 0.6,
    }));

  const inRect = (b, r) => b.cx >= r.x && b.cx < r.x + r.w && b.cy >= r.y && b.cy < r.y + r.h;
  const join = (list) =>
    list
      .sort((a, b) => (Math.abs(a.cy - b.cy) > Math.max(a.h, b.h) * 0.5 ? a.cy - b.cy : a.cx - b.cx))
      .map((b) => b.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

  const lineTexts = geometry.textLines.map((L) =>
    join(boxes.filter((b) => inRect(b, { x: L.x, y: L.y, w: L.w, h: L.h }))));

  const tableGrids = geometry.tables.map((t) => {
    const g = Array.from({ length: t.rows }, () => Array.from({ length: t.cols }, () => ''));
    const conf = Array.from({ length: t.rows }, () => Array.from({ length: t.cols }, () => null));
    for (const cell of t.cells) {
      const hits = boxes.filter((b) => inRect(b, cell.bounds));
      g[cell.row][cell.col] = join(hits);
      conf[cell.row][cell.col] = hits.length
        ? hits.reduce((s, b) => s + b.confidence, 0) / hits.length
        : null;
    }
    return { grid: g, confidence: conf };
  });

  return { boxes, lineTexts, tableGrids };
}

/**
 * @param {object} geometry  GRIDLIFT geometry graph
 * @param {object} ctx       GRIDLIFT run context (packed masks, segments)
 * @param {object} ocr       optional { boxes: [{x,y,w,h,text,confidence}] } in source coords
 */
export function analyseInvoice(geometry, ctx, ocr = null, options = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) };
  const attached = attachText(geometry, ocr ?? { boxes: [] }, options);
  const textOf = (i) => attached.lineTexts[i] ?? '';

  // ---- regions ----------------------------------------------------------
  // Only *line-item* tables define the ITEM_TABLE zone. GRIDLIFT will happily
  // (and correctly) report the summary ladder as a 2-column table, but zoning
  // it as ITEM_TABLE would hide "Grand Total" from the summary extractor.
  const itemTables = pickItemTables(geometry.tables);
  const zoning = classifyRegions(geometry.textLines.map(toLineShape), textOf, itemTables, {
    width: geometry.image.workingWidth,
    height: geometry.image.workingHeight,
  });

  // ---- tables -----------------------------------------------------------
  const tables = [];
  for (let ti = 0; ti < geometry.tables.length; ti++) {
    const table = geometry.tables[ti];
    const grid = attached.tableGrids[ti]?.grid ?? emptyGrid(table);
    const cellConf = attached.tableGrids[ti]?.confidence ?? null;

    const decorative = rejectDecorative(table, ctx);
    if (decorative.rejected) {
      tables.push({ index: ti, rejected: true, reasons: decorative.reasons, bounds: table.bounds });
      continue;
    }

    let workingTable = table;
    let workingGrid = grid;
    let columnInfo = classifyColumns(workingGrid, workingTable);

    // Semantic repair: fold adjacent prose columns back together, then re-type.
    const merges = planColumnMerges(workingTable, workingGrid, ctx, {
      headerRow: columnInfo.headerRow,
    });
    if (merges) {
      ({ table: workingTable, grid: workingGrid } = applyColumnMerges(workingTable, workingGrid, merges));
      columnInfo = classifyColumns(workingGrid, workingTable);
    }

    const logicalRows = reconstructRows(workingGrid, workingTable, columnInfo);
    const items = validateLineArithmetic(buildLineItems(logicalRows, columnInfo));
    const pattern = analyseBorderless({ ...workingTable, borderless: table.borderless }, workingGrid, ctx);

    const summary = extractSummary(zoning.lines);
    const reconciliation = reconcile(items, summary);
    const arith = arithmeticScore(items, reconciliation);

    const evidence = {
      geometry: table.confidence,
      text: textEvidence(attached.boxes, table.bounds),
      alignment: pattern.patternScore,
      semantic: semanticEvidence(columnInfo),
      arithmetic: ocr ? arith : null,
    };
    const fused = fuse(evidence, weights);

    tables.push({
      index: ti,
      rejected: false,
      bounds: table.bounds,
      // Column merging renumbers columns, so escalation must address cells on
      // the *resolved* table, not on the raw geometry table.
      resolved: workingTable,
      rows: workingTable.rows,
      cols: workingTable.cols,
      mergedColumns: workingTable.mergedColumns ?? [],
      borderless: table.borderless,
      gridEvidence: table.evidence,
      gridParts: table.parts,
      pattern,
      columns: columnInfo.columns,
      headerRow: columnInfo.headerRow,
      arithmeticColumns: columnInfo.arithmetic,
      logicalRows,
      items,
      summary,
      reconciliation,
      cellConfidence: cellConf,
      confidence: fused.score,
      evidence: fused.contributions,
    });
  }

  // The primary table is the line-item table, and column count is what tells
  // it apart from the summary ladder - not size or confidence, both of which a
  // clean 2-column summary block wins.
  const primary = tables.filter((t) => !t.rejected)
    .sort((a, b) =>
      (b.cols * 2 + (b.items?.length ?? 0) + b.confidence) -
      (a.cols * 2 + (a.items?.length ?? 0) + a.confidence))[0] ?? null;

  let summary = primary?.summary ?? extractSummary(zoning.lines);
  if (!Object.keys(summary.values ?? {}).length) {
    // Nothing landed in the SUMMARY/TAX zones - widen the search rather than
    // reporting an invoice with no totals.
    summary = extractSummary(zoning.lines, { regionsOfInterest: Object.values(REGION) });
  }
  const invoice = assembleInvoice(zoning, primary, summary, geometry);

  // ---- what still needs help --------------------------------------------
  const escalations = collectEscalations(geometry, tables, attached, options);

  return {
    invoice,
    regions: zoning.regions,
    taggedLines: zoning.lines,
    tables,
    primaryTableIndex: primary?.index ?? null,
    confidence: primary?.confidence ?? 0,
    escalations,
    hasOcr: !!ocr,
  };
}

/**
 * A line-item table has at least three columns (something to name the item,
 * something to count it, something to price it) and several rows. Two-column
 * blocks are summary ladders or address grids, whatever their confidence.
 */
function pickItemTables(tables) {
  const candidates = tables.filter((t) => t.cols >= 3 && t.rows >= 3);
  if (candidates.length) return candidates;
  const best = [...tables].sort((a, b) => b.cols - a.cols || b.rows - a.rows)[0];
  return best ? [best] : [];
}

const toLineShape = (L) => ({
  x0: L.x, y0: L.y, x1: L.x + L.w - 1, y1: L.y + L.h - 1,
  cy: L.y + L.h / 2,
  medianHeight: L.h,
});

const emptyGrid = (table) =>
  Array.from({ length: table.rows }, () => Array.from({ length: table.cols }, () => ''));

function assembleInvoice(zoning, table, summary, geometry) {
  const textIn = (region) =>
    zoning.lines.filter((l) => l.region === region).map((l) => l.text).filter(Boolean);

  const header = textIn(REGION.HEADER).join(' ');
  const invoiceNo = matchField(zoning.lines, [/invoice\s*(?:no|number|#)\s*[:.\-]?\s*([A-Z0-9\-/]{2,})/i, /bill\s*no\s*[:.\-]?\s*([A-Z0-9\-/]{2,})/i]);
  const date = matchField(zoning.lines, [/(?:invoice\s*)?date\s*[:.\-]?\s*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{2,4})/i]);

  return {
    documentType: /credit note/i.test(header) ? 'CREDIT_NOTE'
      : /proforma/i.test(header) ? 'PROFORMA'
      : /tax invoice/i.test(header) ? 'TAX_INVOICE'
      : /invoice/i.test(header) ? 'INVOICE'
      : 'UNKNOWN',
    invoiceNumber: invoiceNo,
    date,
    seller: textIn(REGION.SELLER),
    buyer: textIn(REGION.BUYER),
    shipping: textIn(REGION.SHIPPING),
    payment: textIn(REGION.PAYMENT),
    lineItems: table?.items ?? [],
    totals: summary.values ?? {},
    checks: [
      ...(table?.items ?? []).flatMap((i) => i.checks.map((c) => ({ scope: `item ${i.index}`, ...c }))),
      ...(table?.reconciliation?.checks ?? []).map((c) => ({ scope: 'document', ...c })),
    ],
    geometryConfidence: geometry.confidence,
  };
}

function matchField(lines, patterns) {
  for (const l of lines) {
    for (const re of patterns) {
      const m = (l.text || '').match(re);
      if (m) return m[1].trim();
    }
  }
  return null;
}

/**
 * ROI escalation: name the *rectangles* that are unresolved, not the page.
 * Sending a 12 MP invoice through a VL model to fix one ambiguous cell is the
 * single most expensive mistake available in this design.
 */
function collectEscalations(geometry, tables, attached, options) {
  const cellThreshold = options.cellThreshold ?? 0.55;
  const out = [];
  const scale = geometry.image.scale;

  for (const t of tables) {
    if (t.rejected) {
      out.push({
        kind: 'ambiguous-region',
        reason: t.reasons.join('; '),
        bounds: t.bounds,
        sourceBounds: scaleRect(t.bounds, scale),
        priority: 0.4,
      });
      continue;
    }
    const gt = t.resolved ?? geometry.tables[t.index];

    // Cells whose fused confidence is low.
    for (const cell of gt.cells) {
      const role = t.columns?.[cell.col]?.role;
      const rowItem = t.items.find((i) => i.physicalRows?.includes(cell.row));
      const arithmeticOk = rowItem
        ? rowItem.checks.some((c) => c.check === 'lineProduct' && c.status === 'ok')
        : null;
      const fused = fuseCell(cell, { columnRole: role, ocrBoxes: attached.boxes, arithmeticOk });
      if (fused.score < cellThreshold && (cell.hasText || cell.inkRatio > 0.01)) {
        out.push({
          kind: 'cell',
          table: t.index, row: cell.row, col: cell.col, role: role ?? ROLE.UNKNOWN,
          reason: 'low fused cell confidence',
          score: fused.score,
          bounds: cell.bounds,
          sourceBounds: cell.sourceBounds,
          priority: 1 - fused.score,
        });
      }
    }

    // Rows whose arithmetic does not close - escalate the whole row, because
    // the error may be in any of its three numbers.
    for (const item of t.items) {
      const bad = item.checks.find((c) => c.check === 'lineProduct' && (c.status === 'mismatch' || c.status === 'decimal-point'));
      if (!bad) continue;
      const bounds = { x: gt.bounds.x, y: item.bounds.y, w: gt.bounds.w, h: item.bounds.h };
      out.push({
        kind: 'row',
        table: t.index, row: item.index,
        reason: `arithmetic ${bad.status}: ${bad.detail}`,
        bounds,
        sourceBounds: scaleRect(bounds, scale),
        priority: bad.status === 'mismatch' ? 0.9 : 0.7,
      });
    }

    // Unclassified columns.
    for (const col of t.columns ?? []) {
      if (col.role !== ROLE.UNKNOWN) continue;
      const bounds = { x: col.bounds.x, y: gt.bounds.y, w: col.bounds.w, h: gt.bounds.h };
      out.push({
        kind: 'column',
        table: t.index, col: col.index,
        reason: 'column role unresolved',
        bounds,
        sourceBounds: scaleRect(bounds, scale),
        priority: 0.6,
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}

const scaleRect = (b, scale) => ({
  x: Math.round(b.x / scale),
  y: Math.round(b.y / scale),
  w: Math.round(b.w / scale),
  h: Math.round(b.h / scale),
});

/** Convenience for callers that only want to know whether a token parses. */
export const isNumeric = (s) => classifyToken(s).value != null;
