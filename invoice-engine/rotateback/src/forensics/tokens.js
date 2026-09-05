/**
 * Token typing - the vocabulary the rest of InvoiceForensics reasons over.
 *
 * Everything above geometry needs to know what a piece of text *is* before it
 * can know what it *means*. A column of "10 / 5 / 3" and a column of
 * "50.00 / 25.00 / 15.00" are geometrically identical and semantically nothing
 * alike, and it is the token type that separates them.
 */

export const TOKEN = {
  INT: 'int',
  MONEY: 'money',
  DECIMAL: 'decimal',
  PERCENT: 'percent',
  DATE: 'date',
  CODE: 'code',
  TEXT: 'text',
  EMPTY: 'empty',
};

const CURRENCY = '[$€£¥₹৳]|(?:USD|EUR|GBP|INR|BDT|AUD|CAD|SGD|AED|JPY|Tk|Rs)';

const RE = {
  money: new RegExp(`^\\s*(?:${CURRENCY})?\\s*-?\\(?\\d{1,3}(?:[ ,]\\d{3})*(?:[.,]\\d{2})\\)?\\s*(?:${CURRENCY})?\\s*$`, 'i'),
  moneyLoose: new RegExp(`^\\s*(?:${CURRENCY})\\s*-?[\\d ,.]+\\s*$`, 'i'),
  int: /^\s*-?\d{1,6}(?:\.0+)?\s*(?:pcs|pc|nos|no|units?|box(?:es)?|pkt|kg|gm?|ml|l|ea)?\s*$/i,
  decimal: /^\s*-?\d+[.,]\d+\s*$/,
  percent: /^\s*-?\d+(?:[.,]\d+)?\s*%\s*$/,
  date: /^\s*(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}\s*[-/]?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*[-/,]?\s*\d{2,4})\s*$/i,
  code: /^\s*[A-Z0-9][A-Z0-9\-_/]{2,}\s*$/,
};

/** Parse a numeric string that may use , or . as the decimal separator. */
export function parseNumber(text) {
  if (text == null) return null;
  let s = String(text).replace(new RegExp(CURRENCY, 'gi'), '').trim();
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-]/g, '').replace(/\s/g, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const sep = Math.max(lastComma, lastDot);
  if (sep >= 0 && s.length - sep - 1 <= 2 && s.length - sep - 1 > 0) {
    // The rightmost separator with 1-2 trailing digits is the decimal point;
    // every other separator is a thousands mark. Handles 1.234,56 and 1,234.56.
    const intPart = s.slice(0, sep).replace(/[.,]/g, '');
    const frac = s.slice(sep + 1);
    s = `${intPart}.${frac}`;
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return negative ? -v : v;
}

export function classifyToken(text) {
  const t = (text ?? '').trim();
  if (!t) return { type: TOKEN.EMPTY, value: null, text: t };
  if (RE.percent.test(t)) return { type: TOKEN.PERCENT, value: parseNumber(t), text: t };
  if (RE.money.test(t) || RE.moneyLoose.test(t)) return { type: TOKEN.MONEY, value: parseNumber(t), text: t };
  if (RE.date.test(t)) return { type: TOKEN.DATE, value: null, text: t };
  if (RE.int.test(t)) return { type: TOKEN.INT, value: parseNumber(t), text: t };
  if (RE.decimal.test(t)) return { type: TOKEN.DECIMAL, value: parseNumber(t), text: t };
  if (RE.code.test(t) && /\d/.test(t)) return { type: TOKEN.CODE, value: null, text: t };
  return { type: TOKEN.TEXT, value: null, text: t };
}

/**
 * The type of a *column*: the dominant non-empty token type, plus how dominant
 * it is. A column that is 90% money with one stray word is a money column with
 * one OCR error, not a text column.
 */
export function columnTokenProfile(texts) {
  const types = texts.map((t) => classifyToken(t).type);
  const counts = new Map();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  const nonEmpty = types.filter((t) => t !== TOKEN.EMPTY).length;
  let best = TOKEN.EMPTY, bestN = 0;
  for (const [t, n] of counts) {
    if (t === TOKEN.EMPTY) continue;
    if (n > bestN) { best = t; bestN = n; }
  }
  // MONEY and DECIMAL are the same family; merge so a mixed "50.00 / 50" column
  // does not read as two competing types.
  const numericFamily = [TOKEN.MONEY, TOKEN.DECIMAL, TOKEN.INT];
  const numericCount = numericFamily.reduce((s, t) => s + (counts.get(t) ?? 0), 0);
  return {
    type: best,
    purity: nonEmpty ? bestN / nonEmpty : 0,
    numericRatio: nonEmpty ? numericCount / nonEmpty : 0,
    emptyRatio: types.length ? (types.length - nonEmpty) / types.length : 1,
    counts: Object.fromEntries(counts),
  };
}
