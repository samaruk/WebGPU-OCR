/**
 * Stages 14-15 - cell reconstruction, confidence, and the geometry graph.
 *
 * Output is deliberately *geometry*, not text: rectangles, membership and
 * confidences. OCR is handed cells to read, never asked to discover them.
 * Every rectangle is emitted in both working-resolution and source-resolution
 * coordinates, because the crops fed to OCR must come from the full-resolution
 * original, not from the downsampled working image.
 */

import { laneAt, LANE } from './pipeline.js';
import { groupWords } from './geometry.js';

export function buildCells(hypothesis, band, ctx) {
  const { xs, ys } = hypothesis;
  const { packed, width, height, hSegs, vSegs, scale } = ctx;
  const cols = xs.length - 1;
  const rows = ys.length - 1;

  const words = band.lines.flatMap((L, li) =>
    L.words.map((w) => ({ ...w, lineIndex: li })));

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(xs[c]);
      const y = Math.round(ys[r]);
      const x1 = Math.round(xs[c + 1]);
      const y1 = Math.round(ys[r + 1]);
      const w = Math.max(1, x1 - x);
      const h = Math.max(1, y1 - y);

      const inside = words.filter((wd) => wd.cx >= x && wd.cx < x1 && wd.cy >= y && wd.cy < y1);
      const ink = cellInk(packed, width, height, x, y, x1, y1);

      const bordered =
        hasRule(hSegs, 'h', y, x, x1) || hasRule(hSegs, 'h', y1, x, x1) ||
        hasRule(vSegs, 'v', x, y, y1) || hasRule(vSegs, 'v', x1, y, y1);

      cells.push({
        row: r,
        col: c,
        bounds: { x, y, w, h },
        sourceBounds: toSource({ x, y, w, h }, scale),
        hasText: inside.length > 0,
        hasBorder: bordered,
        inkRatio: +ink.toFixed(4),
        words: inside.map((wd) => ({
          x: wd.x, y: wd.y, w: wd.w, h: wd.h,
          sourceBounds: toSource({ x: wd.x, y: wd.y, w: wd.w, h: wd.h }, scale),
        })),
        confidence: cellConfidence(inside, ink, bordered),
      });
    }
  }

  return {
    rows,
    cols,
    xs: xs.map((v) => Math.round(v)),
    ys: ys.map((v) => Math.round(v)),
    cells,
    bounds: {
      x: Math.round(xs[0]), y: Math.round(ys[0]),
      w: Math.round(xs[cols] - xs[0]), h: Math.round(ys[rows] - ys[0]),
    },
  };
}

function cellConfidence(words, inkRatio, bordered) {
  // An empty cell is not low-confidence - "confidently empty" is a real answer
  // and the arithmetic checks downstream depend on being able to trust it.
  if (!words.length) {
    return inkRatio < 0.005 ? 0.92 : 0.45;
  }
  let conf = 0.6 + Math.min(0.25, words.length * 0.08);
  if (bordered) conf += 0.1;
  // Ink present that no word claimed means something was clipped by a boundary.
  const claimed = words.reduce((s, w) => s + w.w * w.h, 0);
  if (claimed > 0 && inkRatio > 0.5) conf -= 0.15;
  return +Math.max(0, Math.min(1, conf)).toFixed(3);
}

function cellInk(packed, width, height, x0, y0, x1, y1) {
  const a = Math.max(0, x0), b = Math.min(width - 1, x1 - 1);
  const c = Math.max(0, y0), d = Math.min(height - 1, y1 - 1);
  if (b < a || d < c) return 0;
  let sum = 0;
  for (let y = c; y <= d; y++) {
    const row = y * width;
    for (let x = a; x <= b; x++) sum += laneAt(packed, row + x, LANE.OCR);
  }
  return sum / (255 * (b - a + 1) * (d - c + 1));
}

function hasRule(segs, axis, pos, lo, hi, tol = 5) {
  return segs.some((s) => {
    if (axis === 'h') {
      return Math.abs(s.y - pos) <= tol && s.x0 <= hi - 2 && s.x1 >= lo + 2;
    }
    return Math.abs(s.x - pos) <= tol && s.y0 <= hi - 2 && s.y1 >= lo + 2;
  });
}

export const toSource = (b, scale) => ({
  x: Math.round(b.x / scale),
  y: Math.round(b.y / scale),
  w: Math.round(b.w / scale),
  h: Math.round(b.h / scale),
});

/* ------------------------------------------------------------------ *
 * Stage 15 - geometry graph
 * ------------------------------------------------------------------ */

/**
 * Overall confidence blends the winning hypothesis' score with how decisively
 * it beat the runner-up. Two hypotheses tied at 0.8 is a *less* certain answer
 * than one at 0.75 with the next at 0.4 - the margin is information the score
 * alone throws away, and it is exactly what the escalation controller needs.
 */
export function geometryConfidence(ranked, cellSummary) {
  if (!ranked.length) return 0;
  const best = ranked[0].score;
  const second = ranked[1]?.score ?? 0;
  const margin = best - second;
  const decisiveness = Math.min(1, 0.5 + margin * 2.5);
  const cellQuality = cellSummary.meanCellConfidence ?? 0.5;
  return +Math.max(0, Math.min(1, best * 0.6 + decisiveness * 0.2 + cellQuality * 0.2)).toFixed(4);
}

export function summariseCells(table) {
  const cs = table.cells;
  const withText = cs.filter((c) => c.hasText);
  return {
    total: cs.length,
    populated: withText.length,
    bordered: cs.filter((c) => c.hasBorder).length,
    meanCellConfidence: cs.length
      ? +(cs.reduce((s, c) => s + c.confidence, 0) / cs.length).toFixed(3)
      : 0,
    lowConfidence: cs.filter((c) => c.confidence < 0.5).map((c) => ({ row: c.row, col: c.col })),
  };
}

/**
 * Assemble the geometry graph consumed by InvoiceForensics (and by a .NET
 * host over JSON). Nothing in here is invoice *semantics* - that is the next
 * layer's job.
 */
export function buildGeometryGraph({ gpu, segments, components, lines, bands, tables, skew, timings }) {
  const scale = gpu.scale;
  return {
    version: 1,
    image: {
      sourceWidth: gpu.sourceWidth,
      sourceHeight: gpu.sourceHeight,
      workingWidth: gpu.width,
      workingHeight: gpu.height,
      scale: +scale.toFixed(5),
      skewDeg: skew.skewDeg,
    },
    lines: [
      ...segments.hSegs.map((s) => ({
        axis: 'h', x0: s.x0, x1: s.x1, y: Math.round(s.y),
        length: s.length, thickness: s.thickness,
        crossings: s.crossings, decorative: !!s.decorative,
        tableness: +s.tableness.toFixed(3),
      })),
      ...segments.vSegs.map((s) => ({
        axis: 'v', y0: s.y0, y1: s.y1, x: Math.round(s.x),
        length: s.length, thickness: s.thickness,
        crossings: s.crossings, decorative: !!s.decorative,
        tableness: +s.tableness.toFixed(3),
      })),
    ],
    components: components.filter((c) => c.isText).map((c) => ({
      x: c.x, y: c.y, w: c.w, h: c.h,
      area: c.area, density: +c.density.toFixed(3), aspect: +c.aspect.toFixed(3),
    })),
    textLines: lines.map((L) => ({
      x: L.x0, y: L.y0, w: L.x1 - L.x0 + 1, h: L.y1 - L.y0 + 1,
      words: groupWords(L).map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h })),
      sourceBounds: toSource({ x: L.x0, y: L.y0, w: L.x1 - L.x0 + 1, h: L.y1 - L.y0 + 1 }, scale),
    })),
    bands: bands.map((b) => ({
      x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1,
      lineCount: b.lines.length, affinity: +b.affinity.toFixed(3),
    })),
    tables,
    timings,
  };
}
