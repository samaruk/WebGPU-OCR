// stages/12_tableDetector.js — Detect table region from column/row projections

import { CONFIG } from '../config.js';

export async function tableDetector(ctx, bm, pm, w, h) {
  // Read row and column projection arrays from GPU
  const rowRaw = await ctx.readBuffer(bm.getBuffer('row_sums'), h * 4);
  const colRaw = await ctx.readBuffer(bm.getBuffer('col_sums'), w * 4);
  const rowSums = new Uint32Array(rowRaw);
  const colSums = new Uint32Array(colRaw);

  // Detect text-line bands via row projection
  const textLines = detectBands(rowSums, CONFIG.textLines.rowGapTolerance,
    CONFIG.textLines.minLineHeight, w * 0.03);

  // Detect column bands via column projection
  const colBands = detectBands(colSums, CONFIG.table.colGapTolerance, 5, h * 0.03);

  // Find table: region with >= minCols column bands and >= minRows row bands
  const table = findTable(textLines, colBands, w, h);

  return { textLines, colBands, table };
}

/** Find runs of "active" bins in projection array */
function detectBands(proj, gapTol, minSize, minCount) {
  const bands = [];
  let start = -1;
  let gapLen = 0;

  for (let i = 0; i < proj.length; i++) {
    const active = proj[i] >= minCount;
    if (active) {
      if (start === -1) start = i;
      gapLen = 0;
    } else {
      if (start !== -1) {
        gapLen++;
        if (gapLen > gapTol) {
          const end = i - gapLen;
          if (end - start >= minSize) bands.push({ start, end, peak: maxIn(proj, start, end) });
          start = -1; gapLen = 0;
        }
      }
    }
  }
  if (start !== -1 && proj.length - start >= minSize) {
    bands.push({ start, end: proj.length - 1, peak: maxIn(proj, start, proj.length - 1) });
  }
  return bands;
}

function maxIn(arr, s, e) {
  let m = 0;
  for (let i = s; i <= e; i++) m = Math.max(m, arr[i]);
  return m;
}

function findTable(rowBands, colBands, w, h) {
  if (rowBands.length < CONFIG.table.minRows || colBands.length < CONFIG.table.minCols) {
    return null;
  }

  // Find the densest cluster of rows and columns
  // Heuristic: longest contiguous sequence of row bands with consistent spacing
  let bestRegion = null;
  let bestScore = 0;

  for (let rs = 0; rs < rowBands.length; rs++) {
    for (let re = rs + CONFIG.table.minRows - 1; re < rowBands.length; re++) {
      for (let cs = 0; cs < colBands.length; cs++) {
        for (let ce = cs + CONFIG.table.minCols - 1; ce < colBands.length; ce++) {
          const score = (re - rs + 1) * (ce - cs + 1);
          if (score > bestScore) {
            bestScore = score;
            bestRegion = {
              x: colBands[cs].start,
              y: rowBands[rs].start,
              w: colBands[ce].end - colBands[cs].start,
              h: rowBands[re].end - rowBands[rs].start,
              rows: re - rs + 1,
              cols: ce - cs + 1,
              rowBands: rowBands.slice(rs, re + 1),
              colBands: colBands.slice(cs, ce + 1),
            };
          }
        }
      }
    }
  }
  return bestRegion;
}
