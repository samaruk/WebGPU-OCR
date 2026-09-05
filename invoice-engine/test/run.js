/**
 * CPU-stage test suite.
 *
 * Covers GRIDLIFT stages 13-15 and all of InvoiceForensics against synthetic
 * pages that reproduce the layouts the design is meant to survive: ruled,
 * borderless, broken-ruled, decorative, wrapped-row and headerless.
 *
 *   node test/run.js
 */

import assert from 'node:assert/strict';
import { analyseGeometry } from '../src/gridlift/index.js';
import { analyseInvoice, ROLE, REGION } from '../src/forensics/index.js';
import { classifyToken, parseNumber, TOKEN } from '../src/forensics/tokens.js';
import { EscalationController } from '../src/ocr/escalation.js';
import {
  borderedInvoice, borderlessInvoice, brokenBorderInvoice,
  decorativeBannerPage, wrappedRowInvoice, headerlessInvoice,
} from './synthetic.js';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const run = (page) => {
  const { geometry, ctx } = analyseGeometry(page.raw());
  const forensics = analyseInvoice(geometry, ctx, page.ocr());
  return { geometry, ctx, forensics };
};

const roleOf = (table, role) => table.columns.find((c) => c.role === role);
const primary = (f) => f.tables.find((t) => t.index === f.primaryTableIndex);

/* ------------------------------------------------------------------ *
 * tokens
 * ------------------------------------------------------------------ */

test('parseNumber handles both decimal conventions', () => {
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber('1.234,56'), 1234.56);
  assert.equal(parseNumber('1 234,56'), 1234.56);
  assert.equal(parseNumber('50.00'), 50);
  assert.equal(parseNumber('1,234'), 1234);
});

test('parseNumber handles negatives and accounting parentheses', () => {
  assert.equal(parseNumber('-45.50'), -45.5);
  assert.equal(parseNumber('(45.50)'), -45.5);
});

test('classifyToken separates counts from money', () => {
  assert.equal(classifyToken('10').type, TOKEN.INT);
  assert.equal(classifyToken('50.00').type, TOKEN.MONEY);
  assert.equal(classifyToken('$1,250.00').type, TOKEN.MONEY);
  assert.equal(classifyToken('15%').type, TOKEN.PERCENT);
  assert.equal(classifyToken('12/03/2026').type, TOKEN.DATE);
  assert.equal(classifyToken('Paracetamol').type, TOKEN.TEXT);
  assert.equal(classifyToken('').type, TOKEN.EMPTY);
});

/* ------------------------------------------------------------------ *
 * GRIDLIFT stages 13-15
 * ------------------------------------------------------------------ */

test('bordered invoice: rules are detected and crossings recorded', () => {
  const { geometry } = run(borderedInvoice());
  const hRules = geometry.lines.filter((l) => l.axis === 'h' && !l.decorative);
  const vRules = geometry.lines.filter((l) => l.axis === 'v');
  assert.ok(hRules.length >= 5, `expected >=5 h rules, got ${hRules.length}`);
  assert.ok(vRules.length >= 4, `expected >=4 v rules, got ${vRules.length}`);
  assert.ok(vRules.some((v) => v.crossings >= 3), 'expected vertical rules crossing horizontals');
});

test('bordered invoice: a 5-column table is reconstructed', () => {
  const { geometry } = run(borderedInvoice());
  assert.ok(geometry.tables.length >= 1, 'no table found');
  const t = geometry.tables[0];
  assert.equal(t.cols, 5, `expected 5 columns, got ${t.cols} (evidence: ${t.evidence})`);
  assert.ok(t.rows >= 5, `expected >=5 rows, got ${t.rows}`);
  assert.ok(t.parts.splitPenalty === 0, `boundaries split words: ${t.parts.splitPenalty}`);
});

test('borderless invoice: the same table is found with no rules at all', () => {
  const { geometry } = run(borderlessInvoice());
  assert.equal(geometry.lines.length, 0, 'synthetic borderless page should have no rules');
  assert.ok(geometry.tables.length >= 1, 'no table found on borderless page');
  const t = geometry.tables[0];
  assert.ok(t.borderless, 'table should be flagged borderless');
  assert.equal(t.cols, 5, `expected 5 columns, got ${t.cols} (evidence: ${t.evidence})`);
  assert.ok(t.parts.textAlignment > 0.5, `weak alignment evidence: ${t.parts.textAlignment}`);
});

test('broken borders: fragmented rules still yield the right grid', () => {
  const { geometry } = run(brokenBorderInvoice());
  assert.ok(geometry.tables.length >= 1, 'no table found');
  assert.equal(geometry.tables[0].cols, 5, `got ${geometry.tables[0].cols} columns`);
});

test('decorative banner is not reported as a table', () => {
  const { geometry, forensics } = run(decorativeBannerPage());
  const decorative = geometry.lines.filter((l) => l.decorative);
  assert.ok(decorative.length >= 2, 'double rules should be marked decorative');
  const accepted = forensics.tables.filter((t) => !t.rejected && t.rows > 1 && t.cols > 1);
  assert.equal(accepted.length, 0, `decorative banner produced ${accepted.length} table(s)`);
});

test('geometry graph carries source-resolution bounds for cropping', () => {
  const { geometry } = run(borderedInvoice());
  const cell = geometry.tables[0].cells.find((c) => c.hasText);
  assert.ok(cell.sourceBounds.w > 0 && cell.sourceBounds.h > 0);
  assert.equal(cell.sourceBounds.x, cell.bounds.x); // scale 1 in the fixture
});

/* ------------------------------------------------------------------ *
 * InvoiceForensics
 * ------------------------------------------------------------------ */

test('regions: header, buyer and summary zones are separated', () => {
  const { forensics } = run(borderedInvoice());
  const kinds = new Set(forensics.regions.map((r) => r.region));
  assert.ok(kinds.has(REGION.HEADER), 'no HEADER region');
  assert.ok(kinds.has(REGION.ITEM_TABLE), 'no ITEM_TABLE region');
  assert.ok(kinds.has(REGION.SUMMARY) || kinds.has(REGION.TAX), 'no SUMMARY/TAX region');
});

test('columns: roles resolve from headers', () => {
  const { forensics } = run(borderedInvoice());
  const t = primary(forensics);
  assert.ok(roleOf(t, ROLE.DESCRIPTION), 'no DESCRIPTION column');
  assert.ok(roleOf(t, ROLE.QTY), 'no QTY column');
  assert.ok(roleOf(t, ROLE.UNIT_PRICE), 'no UNIT_PRICE column');
  assert.ok(roleOf(t, ROLE.AMOUNT), 'no AMOUNT column');
  assert.ok(roleOf(t, ROLE.AMOUNT).index > roleOf(t, ROLE.QTY).index, 'amount must be right of qty');
});

test('columns: arithmetic types the table with no header row', () => {
  const { forensics } = run(headerlessInvoice());
  const t = primary(forensics);
  assert.ok(t.arithmeticColumns, 'no arithmetic inference');
  assert.ok(t.arithmeticColumns.ratio >= 0.9, `weak arithmetic fit: ${t.arithmeticColumns.ratio}`);
  assert.ok(roleOf(t, ROLE.QTY), 'QTY not inferred');
  assert.ok(roleOf(t, ROLE.AMOUNT), 'AMOUNT not inferred');
  assert.equal(roleOf(t, ROLE.QTY).index, t.arithmeticColumns.qty);
});

test('line items: values parse and qty x rate = amount', () => {
  const { forensics } = run(borderedInvoice());
  const t = primary(forensics);
  assert.equal(t.items.length, 4, `expected 4 items, got ${t.items.length}`);
  const first = t.items[0];
  assert.match(first.description, /Napa/);
  assert.equal(first.qty, 10);
  assert.equal(first.unitPrice, 5);
  assert.equal(first.amount, 50);
  const ok = t.items.every((i) =>
    i.checks.some((c) => c.check === 'lineProduct' && c.status === 'ok'));
  assert.ok(ok, `arithmetic failed: ${JSON.stringify(t.items.map((i) => i.checks))}`);
});

test('summary: subtotal / VAT / grand total are extracted and reconciled', () => {
  const { forensics } = run(borderedInvoice());
  const t = primary(forensics);
  assert.equal(t.summary.values.subtotal, 160);
  assert.equal(t.summary.values.tax, 24);
  assert.equal(t.summary.values.total, 184);
  const totalCheck = t.reconciliation.checks.find((c) => c.check === 'total');
  assert.equal(totalCheck.status, 'ok', totalCheck.detail);
  const subCheck = t.reconciliation.checks.find((c) => c.check === 'subtotal');
  assert.equal(subCheck.status, 'ok', subCheck.detail);
});

test('rows: wrapped descriptions and orphan values fold into one logical row', () => {
  const { forensics } = run(wrappedRowInvoice());
  const t = primary(forensics);
  assert.equal(t.items.length, 2, `expected 2 logical items, got ${t.items.length}: ${t.items.map((i) => i.description)}`);

  const a = t.items[0];
  assert.match(a.description, /Amoxicillin/);
  assert.match(a.description, /blister/, 'continuation line not merged into description');
  assert.equal(a.qty, 10);
  assert.equal(a.amount, 50);

  const b = t.items[1];
  assert.match(b.description, /Ceftriaxone/);
  assert.equal(b.qty, 4, 'orphan value row not folded up');
  assert.equal(b.amount, 100);
  assert.ok(b.merged && b.mergeReasons.length >= 2, 'merge should be explained');
});

test('confidence is high on a clean bordered invoice', () => {
  const { forensics } = run(borderedInvoice());
  assert.ok(forensics.confidence > 0.75, `confidence too low: ${forensics.confidence}`);
});

test('geometry-only run still produces a table and a zoning', () => {
  const page = borderedInvoice();
  const { geometry, ctx } = analyseGeometry(page.raw());
  const f = analyseInvoice(geometry, ctx, null);
  assert.equal(f.hasOcr, false);
  assert.ok(f.tables.filter((t) => !t.rejected).length >= 1);
  assert.ok(f.regions.length >= 2);
});

/* ------------------------------------------------------------------ *
 * Arithmetic forensics
 * ------------------------------------------------------------------ */

test('a lost decimal point is diagnosed, not just flagged', () => {
  const page = borderedInvoice();
  const ocr = page.ocr();
  // Simulate the scanner eating the decimal point in row 1's amount.
  const box = ocr.boxes.find((b) => b.text === '50.00' && b.y < 400);
  box.text = '5000';
  const { geometry, ctx } = analyseGeometry(page.raw());
  const f = analyseInvoice(geometry, ctx, ocr);
  const t = primary(f);
  const bad = t.items.flatMap((i) => i.checks).find((c) => c.status === 'decimal-point');
  assert.ok(bad, `expected a decimal-point diagnosis, got ${JSON.stringify(t.items.map((i) => i.checks))}`);
  assert.equal(bad.suggested, 50);
});

test('a broken line total escalates that row, not the page', () => {
  const page = borderedInvoice();
  const ocr = page.ocr();
  const box = ocr.boxes.find((b) => b.text === '45.00');
  box.text = '54.00';
  const { geometry, ctx } = analyseGeometry(page.raw());
  const f = analyseInvoice(geometry, ctx, ocr);
  const rowEsc = f.escalations.filter((e) => e.kind === 'row');
  assert.ok(rowEsc.length >= 1, 'no row escalation raised');
  const roi = rowEsc[0].sourceBounds;
  const pageArea = geometry.image.sourceWidth * geometry.image.sourceHeight;
  assert.ok(roi.w * roi.h < pageArea * 0.1, 'escalated ROI should be a row, not the page');
});

/* ------------------------------------------------------------------ *
 * Escalation controller
 * ------------------------------------------------------------------ */

test('escalation stops at the accept threshold without calling the sidecar', async () => {
  const page = borderedInvoice();
  const { geometry, ctx } = analyseGeometry(page.raw());
  let sidecarCalls = 0;
  const controller = new EscalationController({
    baseOcr: {
      name: 'fixture',
      async recognize() { return page.ocr(); },
    },
    sidecar: {
      stats: {},
      async recognize() { sidecarCalls++; return { boxes: [] }; },
    },
    analyse: (g, c, o) => analyseInvoice(g, c, o),
    budget: { acceptConfidence: 0.6 },
  });
  const res = await controller.run(null, geometry, ctx);
  assert.equal(res.escalation.outcome, 'accepted');
  assert.equal(sidecarCalls, 0, 'sidecar must not be called when confidence clears the bar');
});

test('escalation budget caps ROI count', async () => {
  const page = borderedInvoice();
  const ocr = page.ocr();
  for (const b of ocr.boxes) if (/^\d+\.\d\d$/.test(b.text)) b.text = 'XX';
  const { geometry, ctx } = analyseGeometry(page.raw());
  let rois = 0;
  const controller = new EscalationController({
    baseOcr: { name: 'fixture', async recognize() { return ocr; } },
    sidecar: {
      stats: {},
      async recognize(_src, rects) { rois += rects.length; return { boxes: [] }; },
      async parseStructure() { return null; },
    },
    analyse: (g, c, o) => analyseInvoice(g, c, o),
    budget: { acceptConfidence: 0.999, maxRois: 5, waveSize: 2, maxMs: 5000 },
  });
  const res = await controller.run(null, geometry, ctx);
  assert.ok(rois <= 5, `escalated ${rois} ROIs, budget was 5`);
  assert.equal(res.escalation.outcome, 'budget-exhausted');
});

/* ------------------------------------------------------------------ */

let passed = 0, failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n').join('\n        ')}`);
  }
}
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
