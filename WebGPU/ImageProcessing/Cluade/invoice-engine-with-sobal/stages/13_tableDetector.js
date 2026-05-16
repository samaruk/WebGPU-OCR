// stages/13_tableDetector.js
// CPU-side analysis of row/column projections to detect table regions.
// A "table" is identified as a vertical region containing regularly spaced
// columns (column separators appear as dips in the col projection at aligned x positions
// across multiple rows).

/**
 * Analyse projection profiles to detect candidate table bounding boxes.
 * @returns {{ tables: Array<{x,y,w,h, cols, rows}> }}
 */
export async function tableDetector(ctx) {
  const { rowProjection, colProjection, width, height, config } = ctx;

  // ── Step 1: Find text rows (non-empty rows in rowProjection) ─────────────
  const threshold  = config.ROW_PROJ_THRESHOLD;
  const gap        = config.LINE_MERGE_GAP;

  const textRows = [];
  let   inRun    = false;
  let   runStart = 0;

  for (let y = 0; y < rowProjection.length; y++) {
    const active = rowProjection[y] > threshold;
    if (active && !inRun) { inRun = true; runStart = y; }
    if (!active && inRun) {
      textRows.push({ y0: runStart, y1: y - 1 });
      inRun = false;
    }
  }
  if (inRun) textRows.push({ y0: runStart, y1: rowProjection.length - 1 });

  // Merge runs separated by ≤ gap pixels
  const mergedRows = mergeRuns(textRows, gap, 'y0', 'y1');

  // ── Step 2: Find column separators (dips in colProjection) ───────────────
  const colSepX = findValleys(colProjection, 0.05);

  // ── Step 3: Identify table regions ───────────────────────────────────────
  // A table region is a group of consecutive mergedRows that share ≥ 2 common column separators.
  const tables = [];
  const minCols = config.TABLE_MIN_COLS;
  const tol     = config.TABLE_COL_ALIGN_TOL;

  // Simple heuristic: if colSepX has ≥ minCols valleys, the whole document might have a table.
  // We detect table regions as contiguous text-row bands where column structure is consistent.

  if (colSepX.length >= minCols - 1) {
    // Group mergedRows into table candidates
    let tableStart = null;
    let prevY1     = -gap - 1;

    for (let i = 0; i < mergedRows.length; i++) {
      const row = mergedRows[i];
      // Start a new table group
      if (tableStart === null) { tableStart = row.y0; }
      // If this row starts far from previous, commit current table
      if (row.y0 > prevY1 + gap * 3 && tableStart !== null && i > 0) {
        commitTable(tables, mergedRows, i - 1, tableStart, colSepX, width, minCols);
        tableStart = row.y0;
      }
      prevY1 = row.y1;
    }
    // Commit final group
    if (tableStart !== null && mergedRows.length > 0) {
      commitTable(tables, mergedRows, mergedRows.length - 1, tableStart, colSepX, width, minCols);
    }
  }

  return { tables, mergedRows, colSepX };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mergeRuns(runs, gap, k0, k1) {
  if (runs.length === 0) return [];
  const out = [{ ...runs[0] }];
  for (let i = 1; i < runs.length; i++) {
    const last = out[out.length - 1];
    if (runs[i][k0] - last[k1] <= gap) {
      last[k1] = Math.max(last[k1], runs[i][k1]);
    } else {
      out.push({ ...runs[i] });
    }
  }
  return out;
}

/** Find valley positions (local minima below threshold) in a 1-D profile */
function findValleys(profile, thresh) {
  const valleys = [];
  for (let x = 1; x < profile.length - 1; x++) {
    if (profile[x] <= thresh &&
        profile[x] <= profile[x - 1] &&
        profile[x] <= profile[x + 1]) {
      valleys.push(x);
    }
  }
  // Merge adjacent valleys
  const merged = [];
  let run = null;
  for (const x of valleys) {
    if (!run) { run = { x0: x, x1: x }; }
    else if (x - run.x1 <= 4) { run.x1 = x; }
    else { merged.push(Math.round((run.x0 + run.x1) / 2)); run = { x0: x, x1: x }; }
  }
  if (run) merged.push(Math.round((run.x0 + run.x1) / 2));
  return merged;
}

function commitTable(tables, rows, endIdx, y0, colSepX, width, minCols) {
  const y1   = rows[endIdx].y1;
  const nRows = rows.filter(r => r.y0 >= y0 && r.y1 <= y1).length;
  if (nRows < 1) return;
  if (colSepX.length < minCols - 1) return;

  tables.push({
    x: 0, y: y0,
    w: width, h: y1 - y0,
    cols: colSepX.length + 1,
    rows: nRows,
    colSepX,
    rowY:  rows.filter(r => r.y0 >= y0 && r.y1 <= y1).map(r => (r.y0 + r.y1) / 2),
  });
}
