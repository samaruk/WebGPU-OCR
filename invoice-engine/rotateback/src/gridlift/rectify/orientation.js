/**
 * Coarse orientation - which way is up, to the nearest quarter turn.
 *
 * This has to happen *before* anything else, and it cannot use text lines,
 * because line clustering groups components by vertical overlap and that is
 * exactly what a 90-degree rotation breaks. So it works on statistics that
 * survive any rotation:
 *
 *   1. glyph aspect       Latin glyphs are taller than wide (w/h ~ 0.5-0.8).
 *                         Median aspect above ~1.15 means the page is on its
 *                         side. This alone is usually decisive.
 *   2. projection peakiness
 *                         Centroids projected across the reading direction
 *                         form sharp periodic peaks (one per line); projected
 *                         along it they are almost uniform. The peakier axis
 *                         is the cross-line axis.
 *
 * Neither can separate 90 from 270, or 0 from 180 - a rotated page is
 * statistically identical to its upside-down twin. `polarityScore` gives a
 * geometric opinion using ascender/descender asymmetry; OCR on two crops is
 * the reliable arbiter and is cheap at that size.
 */

import { median } from '../geometry.js';

/** Coefficient of variation of a smoothed centroid histogram. */
function peakiness(values, extent, smoothRadius) {
  if (values.length < 8) return 0;
  const hist = new Float64Array(Math.max(8, Math.ceil(extent)));
  for (const v of values) {
    const i = Math.min(hist.length - 1, Math.max(0, Math.round(v)));
    hist[i] += 1;
  }
  // Box-smooth at roughly the glyph height so one line becomes one peak.
  const r = Math.max(1, Math.round(smoothRadius));
  const sm = new Float64Array(hist.length);
  let acc = 0;
  for (let i = 0; i < Math.min(r, hist.length); i++) acc += hist[i];
  for (let i = 0; i < hist.length; i++) {
    const add = i + r, rem = i - r - 1;
    if (add < hist.length) acc += hist[add];
    if (rem >= 0) acc -= hist[rem];
    sm[i] = acc;
  }
  let mean = 0;
  for (const v of sm) mean += v;
  mean /= sm.length;
  if (mean <= 0) return 0;
  let varsum = 0;
  for (const v of sm) varsum += (v - mean) ** 2;
  return Math.sqrt(varsum / sm.length) / mean;
}

/**
 * @param {object[]} components decoded components (working coordinates)
 * @returns {{quarterTurns:number, confidence:number, evidence:object,
 *            ambiguous:number[]}}
 *   `quarterTurns` is how many 90-degree CCW turns to apply to make the page
 *   upright; `ambiguous` lists the other quarter-turn value that geometry alone
 *   cannot rule out (the 180-degree twin).
 */
export function estimateOrientation(components, { width, height } = {}) {
  const glyphs = components.filter((c) => c.isText && c.area >= 8 && c.w < width * 0.3);
  if (glyphs.length < 20) {
    return { quarterTurns: 0, confidence: 0, evidence: { reason: 'too few components' }, ambiguous: [] };
  }

  const medW = median(glyphs.map((c) => c.w));
  const medH = median(glyphs.map((c) => c.h));
  const medAspect = median(glyphs.map((c) => c.w / c.h));

  const peakY = peakiness(glyphs.map((c) => c.cy), height, medH * 0.6);
  const peakX = peakiness(glyphs.map((c) => c.cx), width, medW * 0.6);

  // Two independent votes, each in [-1, 1]: positive = the page is sideways.
  const aspectVote = Math.max(-1, Math.min(1, (medAspect - 1.0) / 0.45));
  const denom = peakY + peakX;
  const projectionVote = denom > 1e-6 ? (peakX - peakY) / denom : 0;

  const sideways = aspectVote * 0.55 + projectionVote * 0.45;
  const quarterTurns = sideways > 0 ? 1 : 0;

  return {
    quarterTurns,
    confidence: +Math.min(1, Math.abs(sideways) * 1.6).toFixed(3),
    evidence: {
      medianAspect: +medAspect.toFixed(3),
      medianGlyph: { w: +medW.toFixed(1), h: +medH.toFixed(1) },
      peakinessAcrossY: +peakY.toFixed(3),
      peakinessAcrossX: +peakX.toFixed(3),
      aspectVote: +aspectVote.toFixed(3),
      projectionVote: +projectionVote.toFixed(3),
    },
    // Geometry cannot separate a page from its upside-down twin.
    ambiguous: [quarterTurns, quarterTurns + 2],
  };
}

/**
 * Ascender/descender asymmetry: is the page the right way up, or 180 out?
 *
 * Within a text line the x-height band is dense; ascenders and capitals extend
 * one way, descenders (g j p q y) the other, and ascenders carry far more mass
 * in almost any real document - overwhelmingly so in an invoice full of digits
 * and capitals. Positive = upright, negative = upside down.
 *
 * @param {object[]} lines  clustered text lines (after the quarter-turn fix)
 */
export function polarityScore(lines) {
  let above = 0, below = 0, used = 0;
  for (const L of lines) {
    if (L.items.length < 4) continue;
    const h = L.medianHeight || (L.y1 - L.y0 + 1);
    if (h < 4) continue;

    // x-height band: the modal vertical extent of the line's glyphs.
    const tops = L.items.map((c) => c.y);
    const bots = L.items.map((c) => c.y1);
    const modalTop = medianOf(tops);
    const modalBot = medianOf(bots);

    for (const c of L.items) {
      if (c.y < modalTop - h * 0.12) above += (modalTop - c.y) * c.w;
      if (c.y1 > modalBot + h * 0.12) below += (c.y1 - modalBot) * c.w;
    }
    used++;
  }
  if (!used || above + below <= 0) return { score: 0, upright: true, confidence: 0 };
  const score = (above - below) / (above + below);
  return {
    score: +score.toFixed(3),
    upright: score >= 0,
    confidence: +Math.min(1, Math.abs(score) * 1.5).toFixed(3),
    linesUsed: used,
  };
}

const medianOf = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Rotate a point by whole quarter turns inside a w x h frame.
 * `turns` counts counter-clockwise turns applied to the *image*.
 */
export function rotatePoint(x, y, turns, w, h) {
  switch (((turns % 4) + 4) % 4) {
    case 1: return [y, w - x];
    case 2: return [w - x, h - y];
    case 3: return [h - y, x];
    default: return [x, y];
  }
}

/** The homography for a whole-quarter-turn rotation of a w x h image. */
export function quarterTurnMatrix(turns, w, h) {
  switch (((turns % 4) + 4) % 4) {
    case 1: return Float64Array.from([0, 1, 0, -1, 0, w, 0, 0, 1]);
    case 2: return Float64Array.from([-1, 0, w, 0, -1, h, 0, 0, 1]);
    case 3: return Float64Array.from([0, -1, h, 1, 0, 0, 0, 0, 1]);
    default: return Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
}
