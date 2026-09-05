/**
 * Semantic repair of over-segmented columns.
 *
 * Geometry cannot always tell a column break from a word break. Two-word
 * descriptions that happen to align -
 *
 *     Amoxicillin  Capsule
 *     Ceftriaxone  Injection
 *
 * - leave a whitespace corridor as clean as any real gutter, and the stage-13
 * scorer is right to propose a boundary there. What geometry cannot know, and
 * semantics can, is that both sides are prose: adjacent prose columns with no
 * numeric content and no rule between them are one description column.
 *
 * The repair runs *after* typing, feeding the corrected grid back through
 * classification - evidence flowing from semantics back into geometry, which is
 * the direction the naive pipeline never allows.
 */

import { columnTokenProfile, TOKEN } from './tokens.js';

export function planColumnMerges(table, grid, ctx, { headerRow = 0 } = {}) {
  const body = grid.filter((_, r) => r !== headerRow);
  if (!body.length) return null;

  const profiles = Array.from({ length: table.cols }, (_, c) =>
    columnTokenProfile(body.map((r) => r?.[c] ?? '')));

  const isProse = (c) =>
    profiles[c].type === TOKEN.TEXT && profiles[c].purity >= 0.5 && profiles[c].numericRatio < 0.34;
  const isSparseProse = (c) =>
    profiles[c].emptyRatio >= 0.5 &&
    (profiles[c].type === TOKEN.TEXT || profiles[c].type === TOKEN.EMPTY) &&
    profiles[c].numericRatio < 0.2;

  // A drawn rule between two columns is an explicit statement that they are
  // separate. Never merge across one.
  const ruled = (c) => {
    const x = table.xs[c];
    return (ctx?.vSegs ?? []).some(
      (v) => Math.abs(v.x - x) <= 5 &&
        v.y0 <= table.bounds.y + table.bounds.h * 0.3 &&
        v.y1 >= table.bounds.y + table.bounds.h * 0.7 &&
        v.tableness > 0.25,
    );
  };

  const groups = [[0]];
  for (let c = 1; c < table.cols; c++) {
    const prev = groups[groups.length - 1][groups[groups.length - 1].length - 1];
    const mergeable =
      !ruled(c) &&
      ((isProse(prev) && isProse(c)) ||
       (isProse(prev) && isSparseProse(c)) ||
       (isSparseProse(prev) && isProse(c)));
    if (mergeable) groups[groups.length - 1].push(c);
    else groups.push([c]);
  }

  return groups.length === table.cols ? null : groups;
}

/** Apply a merge plan to both the table geometry and the text grid. */
export function applyColumnMerges(table, grid, groups) {
  const xs = [table.xs[0], ...groups.map((g) => table.xs[g[g.length - 1] + 1])];
  const cells = [];
  for (let r = 0; r < table.rows; r++) {
    groups.forEach((g, newCol) => {
      const parts = table.cells.filter((c) => c.row === r && g.includes(c.col));
      if (!parts.length) return;
      const x = Math.min(...parts.map((p) => p.bounds.x));
      const y = Math.min(...parts.map((p) => p.bounds.y));
      const x1 = Math.max(...parts.map((p) => p.bounds.x + p.bounds.w));
      const y1 = Math.max(...parts.map((p) => p.bounds.y + p.bounds.h));
      cells.push({
        row: r,
        col: newCol,
        bounds: { x, y, w: x1 - x, h: y1 - y },
        sourceBounds: parts[0].sourceBounds && mergeSource(parts),
        hasText: parts.some((p) => p.hasText),
        hasBorder: parts.some((p) => p.hasBorder),
        inkRatio: parts.reduce((s, p) => s + p.inkRatio, 0) / parts.length,
        words: parts.flatMap((p) => p.words),
        confidence: Math.min(...parts.map((p) => p.confidence)),
      });
    });
  }

  const mergedGrid = grid.map((row) =>
    groups.map((g) => g.map((c) => (row?.[c] ?? '').trim()).filter(Boolean).join(' ')));

  return {
    table: {
      ...table,
      cols: groups.length,
      xs,
      cells,
      mergedColumns: groups.filter((g) => g.length > 1),
    },
    grid: mergedGrid,
  };
}

function mergeSource(parts) {
  const x = Math.min(...parts.map((p) => p.sourceBounds.x));
  const y = Math.min(...parts.map((p) => p.sourceBounds.y));
  const x1 = Math.max(...parts.map((p) => p.sourceBounds.x + p.sourceBounds.w));
  const y1 = Math.max(...parts.map((p) => p.sourceBounds.y + p.sourceBounds.h));
  return { x, y, w: x1 - x, h: y1 - y };
}
