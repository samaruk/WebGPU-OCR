/**
 * Logical row reconstruction.
 *
 * The single hardest structural problem in invoice extraction:
 *
 *     Product A
 *     long product description
 *     continued description             10     500
 *
 * A naive reader emits three rows, two of them junk. The physical rows are not
 * the logical row. Merging is driven by *anchors* - the cells a real line item
 * must have (a quantity and/or an amount). A physical row with prose but no
 * anchor is a continuation; a physical row with anchors but no prose is the
 * tail of the item above it. Only a row with both starts a new item.
 */

import { classifyToken, TOKEN } from './tokens.js';
import { ROLE } from './columns.js';

export function reconstructRows(grid, table, columnInfo, { maxGapFactor = 1.8 } = {}) {
  const { columns, headerRow } = columnInfo;
  const roleCols = (role) => columns.filter((c) => c.role === role).map((c) => c.index);
  const descCols = roleCols(ROLE.DESCRIPTION);
  const anchorCols = [...roleCols(ROLE.QTY), ...roleCols(ROLE.AMOUNT), ...roleCols(ROLE.UNIT_PRICE)];

  const slCols = roleCols(ROLE.SL);

  // Where the description column's text normally starts. A continuation line is
  // typically indented under it; a new item is not. This is the signal that
  // separates "Ceftriaxone Injection" (a new item with its numbers still to
  // come) from "with sterile water ampoule" (more of the item above).
  const descLeft = (r) => {
    const xs = table.cells
      .filter((c) => c.row === r && descCols.includes(c.col))
      .flatMap((c) => c.words.map((w) => w.x));
    return xs.length ? Math.min(...xs) : null;
  };
  const allDescLefts = Array.from({ length: table.rows }, (_, r) => descLeft(r)).filter((v) => v != null);
  const baseLeft = allDescLefts.length ? Math.min(...allDescLefts) : 0;
  const descColWidth = descCols.length
    ? table.xs[descCols[0] + 1] - table.xs[descCols[0]]
    : 100;
  const indentThreshold = Math.max(5, descColWidth * 0.03);

  const rowMeta = Array.from({ length: table.rows }, (_, r) => {
    const y0 = table.ys[r];
    const y1 = table.ys[r + 1];
    const texts = grid[r] ?? [];
    const nonEmpty = texts.map((t, i) => [i, (t || '').trim()]).filter(([, t]) => t);
    const hasDesc = descCols.length
      ? descCols.some((c) => (texts[c] || '').trim())
      : nonEmpty.some(([, t]) => classifyToken(t).type === TOKEN.TEXT);
    const hasAnchor = anchorCols.length
      ? anchorCols.some((c) => {
          const tok = classifyToken(texts[c] || '');
          return [TOKEN.INT, TOKEN.MONEY, TOKEN.DECIMAL].includes(tok.type) && tok.value != null;
        })
      : nonEmpty.some(([, t]) => [TOKEN.MONEY, TOKEN.DECIMAL].includes(classifyToken(t).type));
    // A rule drawn under a row is an explicit statement that the item ended.
    const closedBelow = table.cells.some((c) => c.row === r && c.hasBorder && c.bounds.y + c.bounds.h >= y1 - 2);
    const hasSl = slCols.some((c) => (texts[c] || '').trim());
    const left = descLeft(r);
    const indented = left != null && left - baseLeft > indentThreshold;
    return {
      row: r, y0, y1, height: y1 - y0,
      hasDesc, hasAnchor, hasSl, indented,
      empty: nonEmpty.length === 0, closedBelow,
    };
  });

  const heights = rowMeta.filter((m) => !m.empty).map((m) => m.height).sort((a, b) => a - b);
  const medianH = heights.length ? heights[heights.length >> 1] : 12;

  const logical = [];
  for (const m of rowMeta) {
    if (m.empty) continue;
    if (m.row === headerRow) continue;

    const prev = logical[logical.length - 1];
    const gap = prev ? m.y0 - prev.y1 : Infinity;
    const adjacent = gap <= medianH * maxGapFactor;
    const prevClosed = prev ? prev.closedBelow : false;

    const prevComplete = prev ? prev.hasDesc && prev.hasAnchor : false;
    const startsNew =
      !prev ||
      !adjacent ||
      prevClosed ||
      m.hasSl ||                                     // a new serial number
      (m.hasDesc && m.hasAnchor) ||                  // a self-contained item
      (m.hasAnchor && prev.hasAnchor) ||             // second set of values
      (m.hasDesc && !m.indented && prevComplete);    // un-indented new description

    if (startsNew) {
      logical.push({
        rows: [m.row],
        y0: m.y0, y1: m.y1,
        hasDesc: m.hasDesc, hasAnchor: m.hasAnchor,
        closedBelow: m.closedBelow,
        mergeReasons: [],
      });
    } else {
      prev.rows.push(m.row);
      prev.y1 = m.y1;
      prev.hasDesc = prev.hasDesc || m.hasDesc;
      prev.hasAnchor = prev.hasAnchor || m.hasAnchor;
      prev.closedBelow = m.closedBelow;
      prev.mergeReasons.push(
        m.hasAnchor && !m.hasDesc ? `row ${m.row}: orphan values folded up`
          : `row ${m.row}: description continuation`,
      );
    }
  }

  // Materialise each logical row by concatenating its physical cells.
  return logical.map((L, i) => {
    const values = [];
    for (let c = 0; c < table.cols; c++) {
      const parts = L.rows.map((r) => (grid[r]?.[c] ?? '').trim()).filter(Boolean);
      values.push(parts.join(' '));
    }
    return {
      index: i,
      physicalRows: [...L.rows],
      merged: L.rows.length > 1,
      mergeReasons: L.mergeReasons,
      bounds: { y: L.y0, h: L.y1 - L.y0 },
      values,
      complete: L.hasDesc && L.hasAnchor,
    };
  });
}
