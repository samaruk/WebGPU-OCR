// stages/14_cellSegmentation.js
// Given detected tables (with column separators and row positions),
// compute individual cell bounding boxes for OCR cropping.

export async function cellSegmentation(ctx) {
  const { tables, mergedRows, colSepX, width, height, config } = ctx;

  const cells = [];

  for (const table of tables) {
    // Column boundaries: [0, sep0, sep1, ..., width]
    const colBounds = [0, ...table.colSepX, width];

    // Row boundaries from mergedRows within this table
    const tableRows = mergedRows.filter(
      r => r.y0 >= table.y && r.y1 <= table.y + table.h
    );

    for (let ri = 0; ri < tableRows.length; ri++) {
      const row = tableRows[ri];
      for (let ci = 0; ci < colBounds.length - 1; ci++) {
        const x0 = colBounds[ci];
        const x1 = colBounds[ci + 1];
        const y0 = row.y0;
        const y1 = row.y1;

        // Add small padding
        const PAD = 2;
        cells.push({
          tableIdx: tables.indexOf(table),
          row: ri,
          col: ci,
          x: Math.max(0, x0 + PAD),
          y: Math.max(0, y0 - PAD),
          w: Math.min(width,  x1 - x0 - PAD * 2),
          h: Math.min(height, y1 - y0 + PAD * 2),
          text: '',    // filled by OCR stage
        });
      }
    }
  }

  // Also segment non-table text lines for line-by-line OCR
  const textLines = mergedRows
    .filter(row => !tables.some(t => row.y0 >= t.y && row.y1 <= t.y + t.h))
    .map((row, i) => ({
      lineIdx: i,
      x: 0, y: row.y0,
      w: width,
      h: row.y1 - row.y0,
      text: '',
    }));

  return { cells, textLines };
}
