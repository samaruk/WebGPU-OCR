/**
 * Evidence fusion.
 *
 * The wrong architecture is:
 *
 *     GRIDLIFT says A, PaddleOCR says B  ->  take B
 *
 * The right one keeps every source as *evidence with a weight* and lets the
 * combination decide. A geometry engine that is certain and an OCR model that
 * is hesitant should not lose to the model just because the model is bigger.
 *
 * Weights are exposed rather than baked in so they can be fitted on a labelled
 * set later; the defaults below are a reasonable prior, not a truth.
 */

export const DEFAULT_WEIGHTS = {
  geometry: 0.28,   // GRIDLIFT grid score + margin over the runner-up
  text: 0.14,       // OCR word confidence over the table region
  alignment: 0.18,  // borderless pattern evidence
  semantic: 0.16,   // column roles resolved with real evidence
  arithmetic: 0.24, // the identities that must hold if everything is right
};

/**
 * @param {object} e evidence in [0,1] per source; missing sources are dropped
 *                   and the remaining weights renormalised, so a run without
 *                   OCR is not penalised for the absence of text evidence.
 */
export function fuse(e, weights = DEFAULT_WEIGHTS) {
  let acc = 0, wsum = 0;
  const contributions = {};
  for (const [k, w] of Object.entries(weights)) {
    const v = e[k];
    if (v == null || Number.isNaN(v)) continue;
    acc += w * v;
    wsum += w;
    contributions[k] = { value: +v.toFixed(3), weight: w, contribution: +(w * v).toFixed(4) };
  }
  const score = wsum ? acc / wsum : 0;
  return { score: +score.toFixed(4), contributions, coverage: +(wsum).toFixed(3) };
}

/** Mean OCR confidence over boxes intersecting a rectangle. */
export function textEvidence(ocrBoxes, bounds) {
  if (!ocrBoxes?.length) return null;
  const inside = ocrBoxes.filter(
    (b) =>
      b.x + b.w > bounds.x && b.x < bounds.x + bounds.w &&
      b.y + b.h > bounds.y && b.y < bounds.y + bounds.h,
  );
  if (!inside.length) return null;
  const conf = inside.reduce((s, b) => s + (b.confidence ?? 0.6), 0) / inside.length;
  return Math.max(0, Math.min(1, conf));
}

/** How much of the column classification rests on real evidence. */
export function semanticEvidence(columnInfo) {
  if (!columnInfo?.columns?.length) return null;
  const known = columnInfo.columns.filter((c) => c.role !== 'UNKNOWN');
  if (!known.length) return 0;
  const mean = known.reduce((s, c) => s + c.confidence, 0) / known.length;
  const coverage = known.length / columnInfo.columns.length;
  const arithmeticBonus = columnInfo.arithmetic?.ratio >= 0.6 ? 0.15 : 0;
  return Math.max(0, Math.min(1, mean * 0.6 + coverage * 0.4 + arithmeticBonus));
}

/**
 * Per-cell fusion, for the escalation controller: which specific rectangles are
 * worth spending a vision-language model on.
 */
export function fuseCell(cell, { columnRole, ocrBoxes, arithmeticOk }) {
  const e = {
    geometry: cell.confidence,
    text: textEvidence(ocrBoxes, cell.bounds),
    alignment: cell.hasBorder ? 0.85 : cell.hasText ? 0.6 : 0.5,
    semantic: columnRole && columnRole !== 'UNKNOWN' ? 0.85 : 0.35,
    arithmetic: arithmeticOk == null ? null : arithmeticOk ? 0.95 : 0.15,
  };
  return fuse(e);
}
