/**
 * Region detection - carve the page into functional zones before anything
 * tries to extract fields.
 *
 * This is cheap and it removes most of the hard cases downstream: a "Total"
 * inside the SUMMARY zone is the invoice total, the identical word inside
 * ITEM_TABLE is a column header, and the same string in the FOOTER is boiler-
 * plate. Without zones every extractor has to re-litigate that ambiguity.
 */

export const REGION = {
  HEADER: 'HEADER',
  SELLER: 'SELLER',
  BUYER: 'BUYER',
  SHIPPING: 'SHIPPING',
  ITEM_TABLE: 'ITEM_TABLE',
  SUMMARY: 'SUMMARY',
  TAX: 'TAX',
  PAYMENT: 'PAYMENT',
  FOOTER: 'FOOTER',
  UNKNOWN: 'UNKNOWN',
};

const LEXICON = [
  [REGION.HEADER, ['tax invoice', 'proforma', 'commercial invoice', 'invoice', 'bill of supply', 'cash memo', 'challan', 'receipt', 'credit note', 'debit note', 'quotation', 'estimate']],
  [REGION.SELLER, ['sold by', 'seller', 'supplier', 'vendor', 'from :', 'gstin', 'vat reg', 'bin no', 'trade licen', 'tin :']],
  [REGION.BUYER, ['bill to', 'billed to', 'invoice to', 'buyer', 'customer', 'client', 'party name', 'm/s']],
  [REGION.SHIPPING, ['ship to', 'shipped to', 'delivery address', 'consignee', 'shipping']],
  [REGION.SUMMARY, ['sub total', 'subtotal', 'grand total', 'net total', 'net amount', 'total amount', 'amount due', 'balance due', 'amount payable', 'in words', 'total :', 'total']],
  [REGION.TAX, ['vat', 'gst', 'cgst', 'sgst', 'igst', 'tax', 'ait', 'tds', 'supplementary duty', 'sd @', 'cess']],
  [REGION.PAYMENT, ['payment', 'bank', 'account no', 'a/c no', 'ifsc', 'swift', 'due date', 'terms', 'cheque', 'paid via', 'upi', 'mobile banking']],
  [REGION.FOOTER, ['thank you', 'authorised signat', 'authorized signat', 'signature', 'terms and conditions', 'e&oe', 'e & o e', 'computer generated', 'this is a system']],
];

function keywordScore(text) {
  const t = (text || '').toLowerCase();
  const scores = new Map();
  for (const [region, words] of LEXICON) {
    for (const w of words) {
      if (t.includes(w)) {
        // Longer keywords are more specific, so they weigh more; "tax invoice"
        // must beat the bare "invoice" and "tax".
        scores.set(region, Math.max(scores.get(region) ?? 0, w.length / 20));
      }
    }
  }
  return scores;
}

/**
 * @param {object[]} lines        GRIDLIFT text lines (working coords)
 * @param {(i:number)=>string} textOf  line index -> recognised text ('' when no OCR)
 * @param {object[]} tables       GRIDLIFT tables
 */
export function classifyRegions(lines, textOf, tables, { width, height }) {
  const tableBands = tables.map((t) => ({ y0: t.bounds.y, y1: t.bounds.y + t.bounds.h }));
  const inTable = (y) => tableBands.some((b) => y >= b.y0 - 4 && y <= b.y1 + 4);

  const tagged = lines.map((L, i) => {
    const text = textOf(i) || '';
    const scores = keywordScore(text);

    // Positional priors. Geometry alone still produces a usable zoning when no
    // OCR has run yet - which is the point, since zone-restricted OCR is how
    // the expensive model gets used sparingly.
    const rel = L.cy / height;
    const bump = (r, v) => scores.set(r, (scores.get(r) ?? 0) + v);
    if (rel < 0.16) bump(REGION.HEADER, 0.35);
    if (rel >= 0.12 && rel < 0.42) { bump(REGION.SELLER, 0.12); bump(REGION.BUYER, 0.15); }
    if (rel > 0.86) bump(REGION.FOOTER, 0.3);

    // Right-hand short lines below the table are the summary ladder.
    const rightAligned = L.x0 > width * 0.5;
    const belowTable = tableBands.length && L.cy > tableBands[0].y1;
    if (rightAligned && belowTable) bump(REGION.SUMMARY, 0.4);

    let best = REGION.UNKNOWN, bestV = 0.18;
    for (const [r, v] of scores) if (v > bestV) { best = r; bestV = v; }
    if (inTable(L.cy)) { best = REGION.ITEM_TABLE; bestV = 0.9; }

    return { index: i, y0: L.y0, y1: L.y1, x0: L.x0, x1: L.x1, region: best, score: +bestV.toFixed(3), text };
  });

  // Fill UNKNOWNs from the nearest labelled neighbour above - address blocks
  // have exactly one labelled line ("Bill To:") and several unlabelled ones.
  for (let i = 0; i < tagged.length; i++) {
    if (tagged[i].region !== REGION.UNKNOWN) continue;
    for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
      const prev = tagged[j];
      if (prev.region === REGION.UNKNOWN || prev.region === REGION.ITEM_TABLE) continue;
      const gap = tagged[i].y0 - prev.y1;
      if (gap < (lines[i].medianHeight || 10) * 2.2) {
        tagged[i].region = prev.region;
        tagged[i].score = Math.max(0.2, prev.score * 0.6);
      }
      break;
    }
  }

  // Merge consecutive lines with the same label into region rectangles.
  const regions = [];
  for (const t of tagged) {
    const last = regions[regions.length - 1];
    if (last && last.region === t.region && t.y0 - last.y1 < height * 0.06) {
      last.y1 = Math.max(last.y1, t.y1);
      last.x0 = Math.min(last.x0, t.x0);
      last.x1 = Math.max(last.x1, t.x1);
      last.lines.push(t.index);
      last.score = Math.max(last.score, t.score);
    } else {
      regions.push({ region: t.region, x0: t.x0, x1: t.x1, y0: t.y0, y1: t.y1, lines: [t.index], score: t.score });
    }
  }

  return {
    lines: tagged,
    regions: regions.map((r) => ({
      region: r.region,
      bounds: { x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 },
      lineIndices: r.lines,
      confidence: +Math.min(1, r.score).toFixed(3),
    })),
  };
}
