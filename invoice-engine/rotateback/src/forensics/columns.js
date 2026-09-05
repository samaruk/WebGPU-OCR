/**
 * Semantic column classification.
 *
 * Geometry gives four columns at x = 100 / 600 / 750 / 950. It cannot tell you
 * which is the quantity. Three independent signals do:
 *
 *   1. the header text, when there is one and OCR read it
 *   2. the token profile of the column body (ints vs money vs prose)
 *   3. arithmetic - the triple (q, p, a) where a == q * p across most rows
 *
 * (3) is the strongest and needs no header at all, which is why a headerless
 * or badly-scanned table still classifies correctly.
 */

import { columnTokenProfile, classifyToken, TOKEN } from './tokens.js';

export const ROLE = {
  SL: 'SL',
  DESCRIPTION: 'DESCRIPTION',
  CODE: 'CODE',
  QTY: 'QTY',
  UNIT: 'UNIT',
  UNIT_PRICE: 'UNIT_PRICE',
  DISCOUNT: 'DISCOUNT',
  TAX_RATE: 'TAX_RATE',
  TAX_AMOUNT: 'TAX_AMOUNT',
  AMOUNT: 'AMOUNT',
  DATE: 'DATE',
  UNKNOWN: 'UNKNOWN',
};

const HEADER_WORDS = {
  [ROLE.SL]: ['sl no', 's/n', 'sr no', 'serial', 'item no', 'sl.', 'sl', '#', 'no.'],
  [ROLE.DESCRIPTION]: ['description', 'particulars', 'item name', 'product', 'medicine', 'goods', 'service', 'item', 'name'],
  [ROLE.CODE]: ['hsn', 'sac', 'sku', 'barcode', 'batch', 'code', 'part no'],
  [ROLE.QTY]: ['quantity', 'qty', 'qnty', 'pcs', 'nos', 'units', 'count'],
  [ROLE.UNIT]: ['uom', 'unit of', 'pack size', 'unit'],
  [ROLE.UNIT_PRICE]: ['unit price', 'u.price', 'rate', 'price', 'mrp', 'per unit', 'unit rate'],
  [ROLE.DISCOUNT]: ['discount', 'disc', 'less'],
  [ROLE.TAX_RATE]: ['vat %', 'gst %', 'tax %', 'vat rate', 'gst rate', 'rate %', 'tax rate'],
  [ROLE.TAX_AMOUNT]: ['vat amount', 'gst amount', 'tax amount', 'vat amt', 'gst amt', 'vat', 'gst', 'tax'],
  [ROLE.AMOUNT]: ['line total', 'net amount', 'amount', 'total', 'value', 'taka', 'amt'],
  [ROLE.DATE]: ['date', 'expiry', 'exp date', 'mfg'],
};

function headerScores(text) {
  const t = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return new Map();
  const out = new Map();
  for (const [role, words] of Object.entries(HEADER_WORDS)) {
    for (const w of words) {
      if (t === w || t.startsWith(w) || t.includes(w)) {
        const exact = t === w ? 1.0 : 0.75;
        out.set(role, Math.max(out.get(role) ?? 0, exact * Math.min(1, 0.4 + w.length / 14)));
      }
    }
  }
  return out;
}

/**
 * The header row is the first row that is mostly prose while the rows beneath
 * it are mostly numeric. That contrast is what identifies it - not its
 * position, because plenty of invoices repeat the header or precede it with a
 * merged title row.
 */
export function findHeaderRow(grid) {
  const nRows = grid.length;
  for (let r = 0; r < Math.min(3, nRows); r++) {
    const row = grid[r];
    const nonEmpty = row.filter((c) => c && c.trim());
    if (nonEmpty.length < 2) continue;
    const textish = nonEmpty.filter((c) => classifyToken(c).type === TOKEN.TEXT).length / nonEmpty.length;
    const below = grid.slice(r + 1, r + 5).flat().filter((c) => c && c.trim());
    const numericBelow = below.length
      ? below.filter((c) => [TOKEN.INT, TOKEN.MONEY, TOKEN.DECIMAL].includes(classifyToken(c).type)).length / below.length
      : 0;
    const headerHits = row.reduce((s, c) => s + (headerScores(c).size ? 1 : 0), 0);
    if (textish >= 0.6 && (numericBelow >= 0.3 || headerHits >= 2)) return r;
  }
  return -1;
}

/**
 * Search numeric column triples for the one satisfying amount = qty * price.
 * Returns the best triple with the fraction of rows it explains.
 */
export function inferByArithmetic(grid, bodyRows, { tolerance = 0.02 } = {}) {
  const nCols = Math.max(0, ...grid.map((r) => r.length));
  const numeric = [];
  for (let c = 0; c < nCols; c++) {
    const vals = bodyRows.map((r) => {
      const tok = classifyToken(grid[r]?.[c] ?? '');
      return [TOKEN.INT, TOKEN.MONEY, TOKEN.DECIMAL].includes(tok.type) ? tok.value : null;
    });
    if (vals.filter((v) => v != null).length >= Math.max(2, bodyRows.length * 0.6)) {
      numeric.push({ col: c, vals });
    }
  }

  let best = null;
  for (const q of numeric) {
    for (const p of numeric) {
      if (p.col === q.col) continue;
      for (const a of numeric) {
        if (a.col === q.col || a.col === p.col) continue;
        // Amount sits to the right of its factors on essentially every invoice
        // ever printed; using that prunes the mirrored (a,p,q) solution.
        if (a.col < p.col || a.col < q.col) continue;
        let hits = 0, usable = 0;
        for (let i = 0; i < bodyRows.length; i++) {
          const qv = q.vals[i], pv = p.vals[i], av = a.vals[i];
          if (qv == null || pv == null || av == null) continue;
          usable++;
          const expect = qv * pv;
          const denom = Math.max(Math.abs(av), Math.abs(expect), 1e-6);
          if (Math.abs(expect - av) / denom <= tolerance) hits++;
        }
        if (usable < 2) continue;
        const ratio = hits / usable;
        if (!best || ratio > best.ratio || (ratio === best.ratio && a.col > best.amount)) {
          best = { qty: q.col, price: p.col, amount: a.col, ratio, usable, hits };
        }
      }
    }
  }
  // Quantities are integers far more often than prices are; if the fit is
  // symmetric, prefer the assignment where qty is the more integral column.
  if (best && best.ratio > 0) {
    const integrality = (col) => {
      const vals = numeric.find((n) => n.col === col)?.vals.filter((v) => v != null) ?? [];
      return vals.length ? vals.filter((v) => Number.isInteger(v)).length / vals.length : 0;
    };
    if (integrality(best.price) > integrality(best.qty) + 0.25) {
      [best.qty, best.price] = [best.price, best.qty];
      best.swapped = true;
    }
  }
  return best;
}

/**
 * @param {string[][]} grid   rows x cols of recognised text ('' when unread)
 * @param {object} table      GRIDLIFT table (for column widths / positions)
 */
export function classifyColumns(grid, table) {
  const nCols = table.cols;
  const headerRow = findHeaderRow(grid);
  const bodyRows = grid.map((_, i) => i).filter((i) => i !== headerRow && grid[i].some((c) => c && c.trim()));

  const colWidths = Array.from({ length: nCols }, (_, c) => table.xs[c + 1] - table.xs[c]);
  const totalWidth = colWidths.reduce((s, v) => s + v, 0) || 1;

  const profiles = Array.from({ length: nCols }, (_, c) =>
    columnTokenProfile(bodyRows.map((r) => grid[r]?.[c] ?? '')));

  const arithmetic = bodyRows.length >= 2 ? inferByArithmetic(grid, bodyRows) : null;

  const columns = [];
  for (let c = 0; c < nCols; c++) {
    const scores = new Map();
    const add = (role, v, why) => {
      const cur = scores.get(role) ?? { score: 0, why: [] };
      cur.score += v;
      if (v > 0) cur.why.push(why);
      scores.set(role, cur);
    };

    // 1. header text
    if (headerRow >= 0) {
      for (const [role, v] of headerScores(grid[headerRow]?.[c])) add(role, v * 1.0, `header:"${grid[headerRow][c]}"`);
    }

    // 2. token profile
    const p = profiles[c];
    const widthShare = colWidths[c] / totalWidth;
    if (p.type === TOKEN.TEXT && p.purity > 0.5) add(ROLE.DESCRIPTION, 0.35 + widthShare, 'prose column');
    if (p.type === TOKEN.INT && p.purity > 0.6) {
      add(ROLE.QTY, 0.4, 'integer column');
      if (c === 0 && isSequential(bodyRows.map((r) => classifyToken(grid[r]?.[c] ?? '').value))) {
        add(ROLE.SL, 0.9, 'leading 1..n sequence');
      }
    }
    if (p.type === TOKEN.MONEY && p.purity > 0.5) {
      add(ROLE.AMOUNT, 0.3, 'money column');
      add(ROLE.UNIT_PRICE, 0.25, 'money column');
    }
    if (p.type === TOKEN.PERCENT) add(ROLE.TAX_RATE, 0.8, 'percent column');
    if (p.type === TOKEN.DATE) add(ROLE.DATE, 0.8, 'date column');
    if (p.type === TOKEN.CODE) add(ROLE.CODE, 0.5, 'code column');
    if (c === nCols - 1 && p.numericRatio > 0.5) add(ROLE.AMOUNT, 0.3, 'rightmost numeric');

    // 3. arithmetic
    if (arithmetic && arithmetic.ratio >= 0.6) {
      const w = 0.9 * arithmetic.ratio;
      if (c === arithmetic.qty) add(ROLE.QTY, w, `qty x price = amount (${Math.round(arithmetic.ratio * 100)}% of rows)`);
      if (c === arithmetic.price) add(ROLE.UNIT_PRICE, w, 'qty x price = amount');
      if (c === arithmetic.amount) add(ROLE.AMOUNT, w, 'qty x price = amount');
    }

    let role = ROLE.UNKNOWN, bestScore = 0.25, why = [];
    for (const [r, v] of scores) if (v.score > bestScore) { role = r; bestScore = v.score; why = v.why; }
    columns.push({
      index: c,
      role,
      confidence: +Math.min(1, bestScore / 1.6).toFixed(3),
      evidence: why,
      header: headerRow >= 0 ? (grid[headerRow]?.[c] ?? '') : '',
      tokenProfile: p,
      bounds: { x: table.xs[c], w: colWidths[c] },
    });
  }

  resolveDuplicates(columns);
  return { headerRow, bodyRows, columns, arithmetic };
}

/**
 * One role, one column. When two columns both claim AMOUNT, the rightmost with
 * the better arithmetic support keeps it and the other falls back to its
 * runner-up - normally UNIT_PRICE, which is the correct reading.
 */
function resolveDuplicates(columns) {
  const single = [ROLE.QTY, ROLE.AMOUNT, ROLE.UNIT_PRICE, ROLE.DESCRIPTION, ROLE.SL];
  for (const role of single) {
    const claimants = columns.filter((c) => c.role === role);
    if (claimants.length < 2) continue;
    claimants.sort((a, b) => b.confidence - a.confidence || b.index - a.index);
    for (const loser of claimants.slice(1)) {
      loser.role = role === ROLE.AMOUNT ? ROLE.UNIT_PRICE
        : role === ROLE.UNIT_PRICE ? ROLE.TAX_AMOUNT
        : ROLE.UNKNOWN;
      loser.confidence = +(loser.confidence * 0.6).toFixed(3);
      loser.evidence = [...loser.evidence, `demoted from ${role}`];
    }
  }
}

function isSequential(values) {
  const v = values.filter((x) => x != null);
  if (v.length < 3) return false;
  let inc = 0;
  for (let i = 1; i < v.length; i++) if (v[i] === v[i - 1] + 1) inc++;
  return inc / (v.length - 1) >= 0.7;
}
