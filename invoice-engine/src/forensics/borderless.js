/**
 * Border-agnostic analysis.
 *
 * Traditional table detection is: find borders -> find intersections -> make
 * cells. That pipeline has nothing to say about a table with no borders, and
 * worse, it says the *wrong* thing about a decorative rule.
 *
 * Here borders are one evidence source among several. This module supplies the
 * evidence that survives when the borders do not:
 *
 *   gutter quality        is the whitespace between columns actually empty?
 *   row pitch regularity  do rows repeat on a constant baseline pitch?
 *   type consistency      does each column hold one kind of token?
 *   repeated pattern      does the same shape of row occur several times?
 *
 * A table with no lines at all can score higher here than a decorative box
 * with four crisp borders and one line of centred text inside it - which is
 * the correct answer in both cases.
 */

import { bandColumnProfile, median } from '../gridlift/geometry.js';
import { columnTokenProfile } from './tokens.js';
import { LANE } from '../gridlift/pipeline.js';

export function analyseBorderless(table, grid, ctx) {
  const { packed, width, height } = ctx;
  const xs = table.xs;
  const ys = table.ys;

  // --- gutter quality ------------------------------------------------------
  // Sample the ink profile across the band and measure how deep the valley is
  // at each interior boundary relative to the column peaks around it.
  const profile = bandColumnProfile(packed, width, height, ys[0], ys[ys.length - 1], LANE.OCR);
  const peak = profile.reduce((m, v) => Math.max(m, v), 0) || 1;
  const gutters = [];
  for (let i = 1; i < xs.length - 1; i++) {
    const x = Math.round(xs[i]);
    const w = Math.max(2, Math.round((xs[i + 1] - xs[i - 1]) * 0.06));
    let minv = Infinity;
    for (let d = -w; d <= w; d++) {
      const px = Math.min(width - 1, Math.max(0, x + d));
      minv = Math.min(minv, profile[px]);
    }
    gutters.push(1 - Math.min(1, minv / (peak * 0.25)));
  }
  const gutterQuality = gutters.length ? gutters.reduce((s, v) => s + v, 0) / gutters.length : 0;

  // --- row pitch regularity ------------------------------------------------
  const pitches = [];
  for (let i = 1; i < ys.length - 1; i++) pitches.push(ys[i + 1] - ys[i]);
  const medPitch = median(pitches);
  const spread = pitches.length > 1 && medPitch > 0
    ? median(pitches.map((p) => Math.abs(p - medPitch))) / medPitch
    : 1;
  const rowPitchRegularity = pitches.length > 1 ? Math.max(0, 1 - spread * 2.5) : 0.4;

  // --- column type consistency --------------------------------------------
  const bodyStart = grid.length > 1 ? 1 : 0;
  const typePurity = [];
  for (let c = 0; c < table.cols; c++) {
    const p = columnTokenProfile(grid.slice(bodyStart).map((r) => r?.[c] ?? ''));
    typePurity.push(p.emptyRatio > 0.8 ? 0 : p.purity);
  }
  const columnTypeConsistency = typePurity.length
    ? typePurity.reduce((s, v) => s + v, 0) / typePurity.length
    : 0;

  // --- repeated row pattern ------------------------------------------------
  // Signature = which columns are populated. A table repeats one signature;
  // a paragraph that happens to align does not.
  const sigs = grid.slice(bodyStart).map((r) => r.map((v) => ((v || '').trim() ? 1 : 0)).join(''));
  const counts = new Map();
  for (const s of sigs) counts.set(s, (counts.get(s) ?? 0) + 1);
  const dominant = Math.max(0, ...counts.values());
  const repeatedPattern = sigs.length ? dominant / sigs.length : 0;

  const patternScore = +(
    gutterQuality * 0.3 +
    rowPitchRegularity * 0.25 +
    columnTypeConsistency * 0.25 +
    repeatedPattern * 0.2
  ).toFixed(4);

  return {
    isBorderless: table.borderless ?? (table.parts?.lineEvidence ?? 0) < 0.25,
    gutterQuality: +gutterQuality.toFixed(3),
    rowPitchRegularity: +rowPitchRegularity.toFixed(3),
    columnTypeConsistency: +columnTypeConsistency.toFixed(3),
    repeatedPattern: +repeatedPattern.toFixed(3),
    patternScore,
  };
}

/**
 * Decorative-band guard.
 *
 *     ==========================
 *            INVOICE
 *     ==========================
 *
 * Four rules, two intersections' worth of "structure", one line of text, and
 * absolutely not a table. Any candidate whose rows/cols are degenerate and
 * whose rules never cross is rejected here rather than shipped as a 1x1 table.
 */
export function rejectDecorative(table, ctx) {
  const { hSegs } = ctx;
  const reasons = [];
  const inBand = hSegs.filter(
    (s) => s.y >= table.bounds.y - 4 && s.y <= table.bounds.y + table.bounds.h + 4,
  );
  const allDecorative = inBand.length > 0 && inBand.every((s) => s.decorative);

  if (allDecorative) reasons.push('all enclosing rules are decorative (no crossings)');
  if (table.rows <= 1) reasons.push('single row');
  if (table.cols <= 1) reasons.push('single column');
  const populated = table.summary?.populated ?? table.cells.filter((c) => c.hasText).length;
  if (populated <= 2) reasons.push('two or fewer populated cells');

  return { rejected: reasons.length >= 2, reasons };
}
