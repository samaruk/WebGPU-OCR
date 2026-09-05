/**
 * Stage 13 - grid hypothesis generation and scoring.
 *
 * GRIDLIFT never says "I found a table". It proposes several grids from
 * independent evidence sources and scores them against each other:
 *
 *   line evidence      do vertical rules sit on the proposed boundaries?
 *   text alignment     are the words in each column actually aligned?
 *   row consistency    do the rows all fill the same cells?
 *   column consistency is every column populated, and does any boundary cut a
 *                      word in half? (a boundary through a word is fatal)
 *   component density  are the cells full, or is this a padded 14-column fit?
 *
 * A bordered table wins on line evidence; a borderless one wins on alignment
 * and row consistency. Same scorer, no separate code path.
 */

import { bandColumnProfile, findGaps, smooth, groupWords, median } from './geometry.js';

/** Cluster 1D values (word edges, rule positions) with a tolerance. */
export function clusterValues(values, tol) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a.v - b.v);
  const out = [];
  let cur = { members: [sorted[0]], sum: sorted[0].v * sorted[0].w, weight: sorted[0].w };
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    const center = cur.sum / Math.max(cur.weight, 1e-6);
    if (s.v - center <= tol) {
      cur.members.push(s);
      cur.sum += s.v * s.w;
      cur.weight += s.w;
    } else {
      out.push({ center: cur.sum / cur.weight, weight: cur.weight, count: cur.members.length });
      cur = { members: [s], sum: s.v * s.w, weight: s.w };
    }
  }
  out.push({ center: cur.sum / cur.weight, weight: cur.weight, count: cur.members.length });
  return out;
}

/** Collapse boundary positions that are closer together than `tol`. */
export function mergeBoundaries(xs, tol) {
  const s = [...xs].sort((a, b) => a - b);
  const out = [];
  for (const x of s) {
    if (!out.length || x - out[out.length - 1] > tol) out.push(x);
    else out[out.length - 1] = (out[out.length - 1] + x) / 2;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Table bands
 * ------------------------------------------------------------------ */

/**
 * A line-item table is a run of consecutive text lines that share a column
 * skeleton. Detecting the band first means column analysis is never polluted
 * by the address block or the letterhead, which have their own, different
 * alignment.
 */
export function findTableBands(lines, { width, tolRatio = 0.012, minColumns = 2, minRows = 2 } = {}) {
  const tol = Math.max(4, width * tolRatio);
  const enriched = lines.map((L) => {
    const words = groupWords(L);
    return { ...L, words, lefts: words.map((w) => w.x), rights: words.map((w) => w.x1) };
  });

  const pairAffinity = (a, b) => {
    if (a.words.length < minColumns || b.words.length < minColumns) return 0;
    let hits = 0;
    for (const wa of a.words) {
      const m = b.words.some(
        (wb) => Math.abs(wb.x - wa.x) <= tol || Math.abs(wb.x1 - wa.x1) <= tol,
      );
      if (m) hits++;
    }
    return hits / Math.max(a.words.length, b.words.length);
  };

  // Growth is measured against the band's accumulated column *skeleton*, not
  // against the immediately preceding line. That difference is what keeps
  //
  //     Ceftriaxone Injection
  //       with sterile water ampoule
  //                          4   25.00   100.00
  //
  // in one band: the last line shares no edge with the line above it, but its
  // three right edges land exactly on the skeleton the band already has.
  const skeletonMatch = (line, skeleton) => {
    if (!line.words.length) return 0;
    let hits = 0;
    for (const w of line.words) {
      if (skeleton.some((e) => Math.abs(e - w.x) <= tol || Math.abs(e - w.x1) <= tol)) hits++;
    }
    return hits / line.words.length;
  };
  const addEdges = (skeleton, line) => {
    for (const w of line.words) { skeleton.push(w.x); skeleton.push(w.x1); }
  };

  const bands = [];
  const consumed = new Array(enriched.length).fill(false);

  for (let i = 0; i + 1 < enriched.length; i++) {
    if (consumed[i]) continue;
    const seedAff = pairAffinity(enriched[i], enriched[i + 1]);
    const seedGap = enriched[i + 1].y0 - enriched[i].y1;
    const seedGapOk = seedGap < Math.max(enriched[i].medianHeight, enriched[i + 1].medianHeight) * 2.5;
    if (seedAff < 0.5 || !seedGapOk) continue;

    const skeleton = [];
    addEdges(skeleton, enriched[i]);
    addEdges(skeleton, enriched[i + 1]);
    const affinities = [seedAff];
    let end = i + 1;

    for (let j = i + 2; j < enriched.length; j++) {
      const prev = enriched[j - 1];
      const cand = enriched[j];
      const gap = cand.y0 - prev.y1;
      if (gap >= Math.max(prev.medianHeight, cand.medianHeight) * 2.5) break;

      const m = skeletonMatch(cand, skeleton);
      const lookahead = j + 1 < enriched.length ? skeletonMatch(enriched[j + 1], skeleton) : 0;
      // Accept a strong match, or a weak line sandwiched between strong ones
      // (a wrapped description between two aligned rows).
      if (m >= 0.5 || (m >= 0.34 && cand.words.length >= 2) || lookahead >= 0.6) {
        addEdges(skeleton, cand);
        affinities.push(m);
        end = j;
      } else break;
    }

    if (end - i + 1 >= minRows) {
      for (let k = i; k <= end; k++) consumed[k] = true;
      bands.push({ start: i, end, affinity: affinities });
    }
  }

  return bands
    .map((bnd) => {
      const rows = enriched.slice(bnd.start, bnd.end + 1);
      return {
        y0: Math.min(...rows.map((r) => r.y0)),
        y1: Math.max(...rows.map((r) => r.y1)),
        x0: Math.min(...rows.map((r) => r.x0)),
        x1: Math.max(...rows.map((r) => r.x1)),
        lines: rows,
        affinity: bnd.affinity.reduce((s, v) => s + v, 0) / bnd.affinity.length,
      };
    })
    .filter((b) => b.lines.length >= minRows)
    .sort((a, b) => b.lines.length - a.lines.length);
}

/* ------------------------------------------------------------------ *
 * Column candidates
 * ------------------------------------------------------------------ */

/**
 * Three independent generators, deliberately kept separate so a hypothesis can
 * be attributed to its evidence source when it wins.
 */
export function columnCandidateSets(band, ctx, cfg) {
  const { packed, width, height, vSegs } = ctx;
  const tol = Math.max(4, width * cfg.hypotheses.mergeRatio);
  const sets = [];

  // --- A. vertical rules crossing the band ---------------------------------
  const rules = vSegs
    .filter((v) => v.y1 >= band.y0 - 8 && v.y0 <= band.y1 + 8 && v.tableness > 0.25)
    .map((v) => v.x);
  if (rules.length >= 1) {
    sets.push({ source: 'rules', xs: mergeBoundaries([band.x0 - 2, ...rules, band.x1 + 2], tol) });
  }

  // --- B. whitespace gutters inside the band -------------------------------
  const profile = smooth(bandColumnProfile(packed, width, height, band.y0, band.y1), 1);
  const minGutter = Math.max(3, width * cfg.hypotheses.minGutterRatio);
  for (const thr of [0.01, 0.035, 0.08]) {
    const gaps = findGaps(profile, { threshold: thr, minWidth: minGutter })
      // Drop the page margins - they are not column breaks.
      .filter((g) => g.start > band.x0 - 2 && g.end < band.x1 + 2);
    if (gaps.length >= cfg.hypotheses.minColumns - 1) {
      sets.push({
        source: `gutters@${thr}`,
        xs: mergeBoundaries([band.x0 - 2, ...gaps.map((g) => g.center), band.x1 + 2], tol),
      });
    }
  }

  // --- C. edge-alignment clusters ------------------------------------------
  // Numeric columns are right-aligned, text columns left-aligned, so both edge
  // families are clustered and the strong clusters kept.
  const lefts = [], rights = [];
  for (const L of band.lines) {
    for (const w of L.words) {
      lefts.push({ v: w.x, w: 1 });
      rights.push({ v: w.x1, w: 1 });
    }
  }
  const nRows = band.lines.length;
  const strongL = clusterValues(lefts, tol).filter((c) => c.count >= Math.max(2, nRows * 0.5));
  const strongR = clusterValues(rights, tol).filter((c) => c.count >= Math.max(2, nRows * 0.5));
  if (strongL.length + strongR.length >= 2) {
    // A boundary sits in the whitespace *between* a right-cluster and the next
    // left-cluster, not on either of them.
    const cuts = [];
    for (const r of strongR) {
      const nextL = strongL.filter((l) => l.center > r.center + 2).sort((a, b) => a.center - b.center)[0];
      if (nextL) cuts.push((r.center + nextL.center) / 2);
    }
    for (const l of strongL) cuts.push(l.center - tol * 0.5);
    if (cuts.length) {
      sets.push({ source: 'alignment', xs: mergeBoundaries([band.x0 - 2, ...cuts, band.x1 + 2], tol) });
    }
  }

  // --- D. unions -----------------------------------------------------------
  if (sets.length > 1) {
    const all = sets.flatMap((s) => s.xs);
    sets.push({ source: 'union', xs: mergeBoundaries(all, tol) });
    const consensus = mergeBoundaries(
      all.filter((x) => sets.filter((s) => s.xs.some((v) => Math.abs(v - x) <= tol)).length >= 2),
      tol,
    );
    if (consensus.length >= cfg.hypotheses.minColumns + 1) {
      sets.push({ source: 'consensus', xs: consensus });
    }
  }

  return sets
    .filter((s) => s.xs.length - 1 >= cfg.hypotheses.minColumns && s.xs.length - 1 <= cfg.hypotheses.maxColumns)
    .slice(0, cfg.hypotheses.maxCandidates);
}

/* ------------------------------------------------------------------ *
 * Row boundaries
 * ------------------------------------------------------------------ */

export function rowBoundaries(band, ctx) {
  const { hSegs } = ctx;
  const inBand = hSegs
    .filter((s) => !s.decorative && s.y >= band.y0 - 12 && s.y <= band.y1 + 12 && s.crossings >= 1)
    .map((s) => s.y)
    .sort((a, b) => a - b);

  if (inBand.length >= band.lines.length) {
    return { ys: mergeBoundaries([band.y0 - 2, ...inBand, band.y1 + 2], 4), source: 'rules' };
  }
  // Fall back to the midpoints between consecutive text lines.
  const ys = [band.y0 - 2];
  for (let i = 0; i + 1 < band.lines.length; i++) {
    ys.push((band.lines[i].y1 + band.lines[i + 1].y0) / 2);
  }
  ys.push(band.y1 + 2);
  return { ys: mergeBoundaries(ys, 2), source: inBand.length ? 'mixed' : 'text-gaps' };
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

export function scoreHypothesis(xs, ys, band, ctx, cfg, gutters = []) {
  const { vSegs, width } = ctx;
  const tol = Math.max(4, width * cfg.hypotheses.mergeRatio);
  const interior = xs.slice(1, -1);
  const cols = xs.length - 1;
  const rows = ys.length - 1;

  const words = band.lines.flatMap((L) => L.words.map((w) => ({ ...w, line: L })));
  if (!words.length || cols < 1 || rows < 1) return null;

  // --- line evidence -------------------------------------------------------
  const supported = interior.filter((x) =>
    vSegs.some((v) => Math.abs(v.x - x) <= tol && v.y1 >= band.y0 && v.y0 <= band.y1 && v.tableness > 0.25),
  ).length;
  const lineEvidence = interior.length ? supported / interior.length : 0;

  // --- boundary violations: a cut through a word is close to disqualifying --
  let split = 0;
  for (const w of words) {
    if (interior.some((x) => x > w.x + 1 && x < w.x1 - 1)) split++;
  }
  const splitPenalty = split / words.length;

  // --- text alignment ------------------------------------------------------
  // Per column, take the tighter of the left-edge and right-edge spread,
  // normalised by column width. Right-aligned money columns then score as well
  // as left-aligned description columns.
  const colOf = (x) => {
    for (let i = 0; i < cols; i++) if (x >= xs[i] && x < xs[i + 1]) return i;
    return -1;
  };
  const buckets = Array.from({ length: cols }, () => ({ lefts: [], rights: [], n: 0 }));
  for (const w of words) {
    const i = colOf(w.cx);
    if (i < 0) continue;
    buckets[i].lefts.push(w.x);
    buckets[i].rights.push(w.x1);
    buckets[i].n++;
  }
  let alignAcc = 0, alignN = 0;
  for (let i = 0; i < cols; i++) {
    const b = buckets[i];
    if (b.n < 2) continue;
    const colW = Math.max(8, xs[i + 1] - xs[i]);
    const spread = Math.min(mad(b.lefts), mad(b.rights));
    alignAcc += Math.max(0, 1 - spread / (colW * 0.25));
    alignN++;
  }
  const textAlignment = alignN ? alignAcc / alignN : 0;

  // --- row consistency -----------------------------------------------------
  const rowOf = (y) => {
    for (let i = 0; i < rows; i++) if (y >= ys[i] && y < ys[i + 1]) return i;
    return -1;
  };
  const occupancy = Array.from({ length: rows }, () => new Set());
  for (const w of words) {
    const r = rowOf(w.cy);
    const c = colOf(w.cx);
    if (r >= 0 && c >= 0) occupancy[r].add(c);
  }
  const sizes = occupancy.map((s) => s.size).filter((n) => n > 0);
  const modeSize = mode(sizes);
  const rowConsistency = sizes.length
    ? sizes.filter((n) => n === modeSize).length / sizes.length
    : 0;

  // --- column consistency --------------------------------------------------
  const colFill = Array.from({ length: cols }, (_, c) =>
    occupancy.filter((s) => s.has(c)).length / Math.max(1, sizes.length));
  const columnConsistency =
    colFill.reduce((s, f) => s + (f >= 0.6 ? 1 : f / 0.6), 0) / cols;

  // --- density -------------------------------------------------------------
  const filled = occupancy.reduce((s, o) => s + o.size, 0);
  const componentDensity = filled / (rows * cols);

  // --- under-segmentation --------------------------------------------------
  // A full-height empty corridor through the band that no boundary sits on is
  // a column break the hypothesis missed. Without this term a fragmented
  // 2-rule scan scores a perfect 1.0 on line evidence for a grid that merges
  // "SL + Description" into one column - a hypothesis that uses every rule it
  // can see and still gets the table wrong.
  const missed = gutters.filter(
    (g) => !xs.some((x) => x >= g.start - tol && x <= g.end + tol),
  ).length;
  const missedGutters = gutters.length ? missed / gutters.length : 0;

  const wgt = cfg.gridScore;
  let score =
    wgt.lineEvidence * lineEvidence +
    wgt.textAlignment * textAlignment +
    wgt.rowConsistency * rowConsistency +
    wgt.columnConsistency * columnConsistency +
    wgt.componentDensity * Math.min(1, componentDensity * 1.4);

  score *= 1 - Math.min(1, splitPenalty * 2.5);      // over-segmentation
  score *= 1 - Math.min(0.6, missedGutters * 0.6);   // under-segmentation

  return {
    score: +score.toFixed(4),
    parts: {
      lineEvidence: +lineEvidence.toFixed(3),
      textAlignment: +textAlignment.toFixed(3),
      rowConsistency: +rowConsistency.toFixed(3),
      columnConsistency: +columnConsistency.toFixed(3),
      componentDensity: +componentDensity.toFixed(3),
      splitPenalty: +splitPenalty.toFixed(3),
      missedGutters: +missedGutters.toFixed(3),
    },
    cols,
    rows,
  };
}

/** Median absolute deviation - robust to one stray word in a column. */
function mad(values) {
  if (values.length < 2) return 0;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

function mode(values) {
  const counts = new Map();
  let best = 0, bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN || (n === bestN && v > best)) { best = v; bestN = n; }
  }
  return best;
}

/** Run all generators for a band and return the ranked hypotheses. */
export function buildHypotheses(band, ctx, cfg) {
  const { ys, source: rowSource } = rowBoundaries(band, ctx);
  const sets = columnCandidateSets(band, ctx, cfg);

  // The band's whitespace corridors, computed once and scored against every
  // hypothesis, so under- and over-segmentation are both penalised.
  const profile = smooth(bandColumnProfile(ctx.packed, ctx.width, ctx.height, band.y0, band.y1), 1);
  const gutters = findGaps(profile, {
    threshold: 0.02,
    minWidth: Math.max(3, ctx.width * cfg.hypotheses.minGutterRatio),
  }).filter((g) => g.start > band.x0 + 2 && g.end < band.x1 - 2);

  const ranked = [];
  for (const set of sets) {
    const scored = scoreHypothesis(set.xs, ys, band, ctx, cfg, gutters);
    if (!scored) continue;
    ranked.push({ source: set.source, rowSource, xs: set.xs, ys, ...scored });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
