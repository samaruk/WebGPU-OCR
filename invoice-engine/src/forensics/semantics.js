/**
 * Invoice semantics and the arithmetic checks.
 *
 * This is what makes the layer "forensic" rather than merely a reader. The
 * question is not "did OCR read this correctly?" but "does this interpretation
 * hold up geometrically, textually and *mathematically*?" An invoice is a
 * closed arithmetic system - line amounts sum to the subtotal, the subtotal
 * plus tax minus discount equals the total - and every one of those identities
 * is a free check on both the layout and the OCR.
 */

import { classifyToken, parseNumber, TOKEN } from './tokens.js';
import { ROLE } from './columns.js';

const num = (s) => {
  const t = classifyToken(s);
  return [TOKEN.INT, TOKEN.MONEY, TOKEN.DECIMAL, TOKEN.PERCENT].includes(t.type) ? t.value : null;
};

export function buildLineItems(logicalRows, columnInfo) {
  const byRole = {};
  for (const c of columnInfo.columns) {
    if (c.role === ROLE.UNKNOWN) continue;
    (byRole[c.role] ??= []).push(c.index);
  }
  const pick = (values, role) => {
    const idx = byRole[role]?.[0];
    return idx == null ? '' : (values[idx] ?? '');
  };

  return logicalRows.map((r) => {
    const item = {
      index: r.index,
      sl: pick(r.values, ROLE.SL),
      code: pick(r.values, ROLE.CODE),
      description: pick(r.values, ROLE.DESCRIPTION),
      unit: pick(r.values, ROLE.UNIT),
      qty: num(pick(r.values, ROLE.QTY)),
      unitPrice: num(pick(r.values, ROLE.UNIT_PRICE)),
      discount: num(pick(r.values, ROLE.DISCOUNT)),
      taxRate: num(pick(r.values, ROLE.TAX_RATE)),
      taxAmount: num(pick(r.values, ROLE.TAX_AMOUNT)),
      amount: num(pick(r.values, ROLE.AMOUNT)),
      raw: r.values,
      bounds: r.bounds,
      physicalRows: r.physicalRows,
      merged: r.merged,
      mergeReasons: r.mergeReasons,
    };
    item.checks = [];
    return item;
  }).filter((it) =>
    // Drop rows that carried neither a description nor a number - those are
    // separator artefacts, not items.
    (it.description && it.description.trim()) || it.qty != null || it.amount != null);
}

/** Relative comparison with an absolute floor, so 0.00 does not divide by zero. */
const close = (a, b, tol = 0.02) =>
  Math.abs(a - b) <= Math.max(0.011, tol * Math.max(Math.abs(a), Math.abs(b)));

export function validateLineArithmetic(items, { tolerance = 0.02 } = {}) {
  for (const it of items) {
    const { qty, unitPrice, amount } = it;
    if (qty == null || unitPrice == null || amount == null) {
      // One missing operand is recoverable - derive it and say so.
      if (qty != null && unitPrice != null && amount == null) {
        it.amount = round2(qty * unitPrice);
        it.checks.push({ check: 'amount', status: 'derived', detail: `${qty} x ${unitPrice}` });
      } else if (qty != null && amount != null && unitPrice == null && qty !== 0) {
        it.unitPrice = round2(amount / qty);
        it.checks.push({ check: 'unitPrice', status: 'derived', detail: `${amount} / ${qty}` });
      } else if (unitPrice != null && amount != null && unitPrice !== 0 && qty == null) {
        it.qty = round2(amount / unitPrice);
        it.checks.push({ check: 'qty', status: 'derived', detail: `${amount} / ${unitPrice}` });
      } else {
        it.checks.push({ check: 'lineProduct', status: 'unavailable' });
      }
      continue;
    }

    const expect = qty * unitPrice;
    const withDiscount = it.discount != null ? expect - it.discount : null;

    if (close(expect, amount, tolerance)) {
      it.checks.push({ check: 'lineProduct', status: 'ok', detail: `${qty} x ${unitPrice} = ${amount}` });
    } else if (withDiscount != null && close(withDiscount, amount, tolerance)) {
      it.checks.push({ check: 'lineProduct', status: 'ok', detail: `(${qty} x ${unitPrice}) - ${it.discount} = ${amount}` });
    } else if (close(expect / 100, amount, tolerance) || close(expect * 100, amount, tolerance)) {
      // The classic scan failure: a decimal point lost to a speck of dust.
      it.checks.push({
        check: 'lineProduct',
        status: 'decimal-point',
        detail: `expected ${round2(expect)}, read ${amount}`,
        suggested: round2(expect),
      });
    } else {
      it.checks.push({
        check: 'lineProduct',
        status: 'mismatch',
        detail: `expected ${round2(expect)}, read ${amount}`,
        suggested: round2(expect),
      });
    }

    if (it.taxRate != null && it.taxAmount != null) {
      const expectTax = (it.amount ?? expect) * (it.taxRate / 100);
      it.checks.push({
        check: 'lineTax',
        status: close(expectTax, it.taxAmount, Math.max(tolerance, 0.03)) ? 'ok' : 'mismatch',
        detail: `${it.taxRate}% of ${round2(it.amount ?? expect)} = ${round2(expectTax)}, read ${it.taxAmount}`,
      });
    }
  }
  return items;
}

/* ------------------------------------------------------------------ *
 * Summary block
 * ------------------------------------------------------------------ */

const SUMMARY_KEYS = [
  ['subtotal', ['sub total', 'subtotal', 'sub-total', 'gross amount', 'gross total', 'total before']],
  ['discount', ['discount', 'less discount', 'disc.', 'rebate']],
  ['tax', ['vat', 'gst', 'tax', 'cgst', 'sgst', 'igst', 'sales tax', 'supplementary duty']],
  ['shipping', ['shipping', 'freight', 'delivery charge', 'carriage']],
  ['rounding', ['round off', 'rounding', 'adjustment']],
  ['total', ['grand total', 'net payable', 'amount payable', 'net total', 'total amount', 'balance due', 'amount due', 'total']],
  ['paid', ['paid', 'advance', 'received']],
];

/**
 * Summary lines are label/value pairs, and the value is always the rightmost
 * number on the line. Parsing right-to-left avoids swallowing the "15" out of
 * "VAT 15%" as the amount.
 */
export function extractSummary(taggedLines, { regionsOfInterest = ['SUMMARY', 'TAX', 'PAYMENT'] } = {}) {
  const found = {};
  const details = [];
  for (const L of taggedLines) {
    if (!regionsOfInterest.includes(L.region)) continue;
    const text = (L.text || '').trim();
    if (!text) continue;

    const matches = [...text.matchAll(/-?\(?[\d][\d ,.]*\)?%?/g)].filter((m) => /\d/.test(m[0]));
    if (!matches.length) continue;
    const last = matches[matches.length - 1][0];
    if (/%$/.test(last) && matches.length > 1) continue;
    const value = parseNumber(last);
    if (value == null) continue;

    const label = text.slice(0, text.lastIndexOf(last)).toLowerCase().replace(/[.:\-–]+$/, '').trim();
    for (const [key, words] of SUMMARY_KEYS) {
      const hit = words.find((w) => label.includes(w));
      if (!hit) continue;
      // "Total" is the weakest key and must not steal a line that also says
      // "Sub Total"; longest-keyword-wins handles that.
      const strength = hit.length;
      if (!found[key] || strength > found[key].strength) {
        found[key] = { value, label: label || hit, strength, text };
      }
      details.push({ key, value, label, text });
      break;
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(found)) out[k] = v.value;
  return { values: out, lines: details };
}

/**
 * Reconcile items against the summary. Each identity that holds is evidence
 * that the *whole* interpretation - grid, columns, OCR - is right.
 */
export function reconcile(items, summary, { tolerance = 0.02 } = {}) {
  const checks = [];
  const amounts = items.map((i) => i.amount).filter((v) => v != null);
  const lineSum = round2(amounts.reduce((s, v) => s + v, 0));
  const s = summary.values ?? {};

  if (amounts.length) {
    checks.push({ check: 'lineSum', status: 'info', value: lineSum, detail: `${amounts.length} line amounts` });
  }
  if (s.subtotal != null && amounts.length) {
    checks.push({
      check: 'subtotal',
      status: close(lineSum, s.subtotal, tolerance) ? 'ok' : 'mismatch',
      detail: `sum(lines)=${lineSum} vs subtotal=${s.subtotal}`,
      suggested: lineSum,
    });
  }
  if (s.total != null) {
    const base = s.subtotal ?? (amounts.length ? lineSum : null);
    if (base != null) {
      const expect = round2(base - (s.discount ?? 0) + (s.tax ?? 0) + (s.shipping ?? 0) + (s.rounding ?? 0));
      checks.push({
        check: 'total',
        status: close(expect, s.total, tolerance) ? 'ok' : 'mismatch',
        detail: `${base}${s.discount ? ` - ${s.discount}` : ''}${s.tax ? ` + ${s.tax}` : ''} = ${expect}, read ${s.total}`,
        suggested: expect,
      });
    }
  }
  if (s.tax != null && s.subtotal != null && s.subtotal !== 0) {
    const rate = (s.tax / s.subtotal) * 100;
    checks.push({
      check: 'taxRate',
      status: 'info',
      detail: `implied rate ${rate.toFixed(2)}%`,
      value: +rate.toFixed(2),
    });
  }
  return { lineSum, checks };
}

/**
 * Arithmetic agreement folded into a single number. Deliberately steep: a
 * failing subtotal is a much stronger signal that something is wrong than a
 * passing one is that everything is right.
 */
export function arithmeticScore(items, reconciliation) {
  const lineChecks = items.flatMap((i) => i.checks).filter((c) => c.check === 'lineProduct');
  const evaluated = lineChecks.filter((c) => c.status !== 'unavailable');
  const okLines = evaluated.filter((c) => c.status === 'ok' || c.status === 'derived').length;
  const lineScore = evaluated.length ? okLines / evaluated.length : 0.5;

  const totals = reconciliation.checks.filter((c) => c.status === 'ok' || c.status === 'mismatch');
  const okTotals = totals.filter((c) => c.status === 'ok').length;
  const totalScore = totals.length ? okTotals / totals.length : 0.5;

  const coverage = evaluated.length ? Math.min(1, evaluated.length / Math.max(1, items.length)) : 0;
  return +(lineScore * 0.5 + totalScore * 0.35 + coverage * 0.15).toFixed(4);
}

export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
