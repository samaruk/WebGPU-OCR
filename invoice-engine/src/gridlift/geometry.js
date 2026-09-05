/**
 * CPU-side decoding of GRIDLIFT's compacted GPU output:
 *   packed mask  -> stroke segments, banded projections
 *   component table -> filtered glyph/word boxes
 *   boxes -> text lines
 *
 * Nothing here re-reads the image. Everything operates on the one packed
 * buffer and the component table the GPU already reduced.
 */

import { LANE, laneAt } from './pipeline.js';

/* ------------------------------------------------------------------ *
 * Components
 * ------------------------------------------------------------------ */

/**
 * @param {Uint32Array} raw   flat component table (stride u32 per component)
 * @param {number} count      how many the GPU actually emitted
 */
export function decodeComponents(raw, count, stride, { width, height, minArea = 6, maxHeightRatio = 0.08 } = {}) {
  const out = [];
  const maxH = height * maxHeightRatio;
  for (let c = 0; c < count; c++) {
    const b = c * stride;
    const x0 = raw[b], y0 = raw[b + 1], x1 = raw[b + 2], y1 = raw[b + 3];
    if (x0 === 0xffffffff || x1 < x0) continue;
    const area = raw[b + 4];
    if (area < minArea) continue;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const strokeArea = raw[b + 5] / 4;
    const comp = {
      id: c,
      x: x0, y: y0, w, h,
      x1, y1,
      cx: x0 + w / 2,
      cy: y0 + h / 2,
      area,
      density: area / (w * h),
      aspect: w / h,
      /** How much of this blob sat on a detected rule - high means it *is* a
       *  rule fragment that survived suppression, not a glyph. */
      strokeRatio: Math.min(1, strokeArea / Math.max(1, area)),
      inkSum: raw[b + 6] / 8,
      root: raw[b + 7],
    };
    // Rule fragments, page-tall artefacts and full-width bars are not text.
    comp.isText =
      comp.strokeRatio < 0.4 &&
      h <= maxH &&
      w < width * 0.85 &&
      !(comp.aspect > 12 && h <= 3) &&
      !(comp.aspect < 0.08 && w <= 3);
    out.push(comp);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Stroke segments
 * ------------------------------------------------------------------ */

/**
 * Extract axis-aligned segments from a mask lane of the packed buffer.
 * Row runs are stitched across adjacent rows when they overlap, which is what
 * turns a 3px-thick rule into one segment with thickness 3 instead of three
 * coincident segments.
 *
 * @param {Uint32Array} packed
 * @param {'h'|'v'} axis
 */
export function extractSegments(packed, width, height, axis, {
  lane = axis === 'h' ? LANE.H : LANE.V,
  minRun = 6,
  minLength = 24,
  overlapRatio = 0.4,
} = {}) {
  const major = axis === 'h' ? height : width; // scan lines
  const minor = axis === 'h' ? width : height; // along-line extent
  const at = axis === 'h'
    ? (line, pos) => laneAt(packed, line * width + pos, lane)
    : (line, pos) => laneAt(packed, pos * width + line, lane);

  const finished = [];
  let active = [];

  for (let line = 0; line < major; line++) {
    // 1. runs on this scan line
    const runs = [];
    let start = -1;
    for (let pos = 0; pos < minor; pos++) {
      const on = at(line, pos) >= 128;
      if (on && start < 0) start = pos;
      else if (!on && start >= 0) {
        if (pos - start >= minRun) runs.push([start, pos - 1]);
        start = -1;
      }
    }
    if (start >= 0 && minor - start >= minRun) runs.push([start, minor - 1]);

    // 2. stitch onto active segments from the previous scan line
    const next = [];
    const used = new Set();
    for (const seg of active) {
      let best = -1, bestOv = 0;
      for (let i = 0; i < runs.length; i++) {
        if (used.has(i)) continue;
        const [a, b] = runs[i];
        const ov = Math.min(seg.p1, b) - Math.max(seg.p0, a) + 1;
        const denom = Math.min(seg.p1 - seg.p0, b - a) + 1;
        if (ov > 0 && ov / denom > overlapRatio && ov > bestOv) { bestOv = ov; best = i; }
      }
      if (best >= 0) {
        const [a, b] = runs[best];
        used.add(best);
        seg.p0 = Math.min(seg.p0, a);
        seg.p1 = Math.max(seg.p1, b);
        seg.l1 = line;
        seg.thickness++;
        next.push(seg);
      } else {
        finished.push(seg);
      }
    }
    for (let i = 0; i < runs.length; i++) {
      if (used.has(i)) continue;
      next.push({ p0: runs[i][0], p1: runs[i][1], l0: line, l1: line, thickness: 1 });
    }
    active = next;
  }
  finished.push(...active);

  return finished
    .map((s) => {
      const length = s.p1 - s.p0 + 1;
      return axis === 'h'
        ? {
            axis: 'h',
            x0: s.p0, x1: s.p1, y0: s.l0, y1: s.l1,
            y: (s.l0 + s.l1) / 2, x: (s.p0 + s.p1) / 2,
            length, thickness: s.thickness,
          }
        : {
            axis: 'v',
            y0: s.p0, y1: s.p1, x0: s.l0, x1: s.l1,
            x: (s.l0 + s.l1) / 2, y: (s.p0 + s.p1) / 2,
            length, thickness: s.thickness,
          };
    })
    .filter((s) => s.length >= minLength)
    .sort((a, b) => b.length - a.length);
}

/**
 * Cross-reference rules against each other.
 *
 * `crossings` is the single most useful border feature: a horizontal rule that
 * several vertical rules terminate on is a table edge; one with zero crossings
 * that spans the page under a centred title is decoration. A pair of parallel
 * full-width rules a few pixels apart is a double rule - decoration again,
 * never a one-row table.
 */
export function annotateSegments(hSegs, vSegs, width, height, { tol = 4 } = {}) {
  for (const s of hSegs) {
    s.crossings = vSegs.filter(
      (v) => v.x >= s.x0 - tol && v.x <= s.x1 + tol && v.y0 - tol <= s.y && v.y1 + tol >= s.y,
    ).length;
    s.spanRatio = s.length / width;
  }
  for (const s of vSegs) {
    s.crossings = hSegs.filter(
      (hh) => hh.y >= s.y0 - tol && hh.y <= s.y1 + tol && hh.x0 - tol <= s.x && hh.x1 + tol >= s.x,
    ).length;
    s.spanRatio = s.length / height;
  }

  // Double-rule detection (decorative "===" banding).
  const wide = hSegs.filter((s) => s.spanRatio > 0.75).sort((a, b) => a.y - b.y);
  for (let i = 0; i + 1 < wide.length; i++) {
    const gap = wide[i + 1].y - wide[i].y;
    if (gap <= 8 && wide[i].crossings === 0 && wide[i + 1].crossings === 0) {
      wide[i].decorative = true;
      wide[i + 1].decorative = true;
    }
  }
  for (const s of hSegs) {
    if (s.decorative === undefined) {
      s.decorative = s.crossings === 0 && s.spanRatio > 0.9 && s.thickness >= 4;
    }
    s.tableness = s.decorative
      ? 0
      : Math.min(1, 0.3 * Math.min(s.crossings, 4) / 4 + 0.5 * s.spanRatio + 0.2 * Math.min(1, s.thickness / 3));
  }
  for (const s of vSegs) {
    s.decorative = false;
    s.tableness = Math.min(1, 0.4 * Math.min(s.crossings, 4) / 4 + 0.4 * s.spanRatio + 0.2 * Math.min(1, s.thickness / 3));
  }
  return { hSegs, vSegs };
}

/* ------------------------------------------------------------------ *
 * Projections
 * ------------------------------------------------------------------ */

/** Column-ink profile restricted to a y-band - the borderless table's fingerprint. */
export function bandColumnProfile(packed, width, height, y0, y1, lane = LANE.OCR) {
  const prof = new Float32Array(width);
  const a = Math.max(0, Math.floor(y0));
  const b = Math.min(height - 1, Math.ceil(y1));
  for (let y = a; y <= b; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) prof[x] += laneAt(packed, row + x, lane) / 255;
  }
  return prof;
}

export function bandRowProfile(packed, width, height, x0, x1, lane = LANE.OCR) {
  const prof = new Float32Array(height);
  const a = Math.max(0, Math.floor(x0));
  const b = Math.min(width - 1, Math.ceil(x1));
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let s = 0;
    for (let x = a; x <= b; x++) s += laneAt(packed, row + x, lane) / 255;
    prof[y] = s;
  }
  return prof;
}

export function smooth(profile, radius) {
  if (radius <= 0) return profile;
  const n = profile.length;
  const out = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < Math.min(radius, n); i++) acc += profile[i];
  for (let i = 0; i < n; i++) {
    const add = i + radius;
    const rem = i - radius - 1;
    if (add < n) acc += profile[add];
    if (rem >= 0) acc -= profile[rem];
    const lo = Math.max(0, i - radius);
    const hi = Math.min(n - 1, i + radius);
    out[i] = acc / (hi - lo + 1);
  }
  return out;
}

/**
 * Runs of near-zero ink wider than `minWidth`. These are the gutters between
 * columns (on a column profile) or the gaps between rows (on a row profile).
 */
export function findGaps(profile, { threshold = 0.02, minWidth = 4 } = {}) {
  const peak = profile.reduce((m, v) => Math.max(m, v), 0);
  const t = peak * threshold;
  const gaps = [];
  let start = -1;
  for (let i = 0; i < profile.length; i++) {
    const low = profile[i] <= t;
    if (low && start < 0) start = i;
    else if (!low && start >= 0) {
      if (i - start >= minWidth) gaps.push({ start, end: i - 1, center: (start + i - 1) / 2, width: i - start });
      start = -1;
    }
  }
  if (start >= 0 && profile.length - start >= minWidth) {
    gaps.push({ start, end: profile.length - 1, center: (start + profile.length - 1) / 2, width: profile.length - start });
  }
  return gaps;
}

/* ------------------------------------------------------------------ *
 * Text lines
 * ------------------------------------------------------------------ */

/**
 * Group components into text lines by vertical overlap. Words on the same
 * baseline overlap heavily even when their heights differ (ascenders,
 * digits, small caps); words on different lines barely overlap at all.
 */
export function clusterLines(components, { overlap = 0.45 } = {}) {
  const boxes = components.filter((c) => c.isText).sort((a, b) => a.cy - b.cy);
  const lines = [];
  for (const c of boxes) {
    let placed = false;
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 6; i--) {
      const L = lines[i];
      const ov = Math.min(L.y1, c.y1) - Math.max(L.y0, c.y) + 1;
      const denom = Math.min(L.y1 - L.y0, c.h) + 1;
      if (ov > 0 && ov / denom >= overlap) {
        L.items.push(c);
        L.y0 = Math.min(L.y0, c.y);
        L.y1 = Math.max(L.y1, c.y1);
        L.x0 = Math.min(L.x0, c.x);
        L.x1 = Math.max(L.x1, c.x1);
        placed = true;
        break;
      }
    }
    if (!placed) lines.push({ items: [c], x0: c.x, x1: c.x1, y0: c.y, y1: c.y1 });
  }
  for (const L of lines) {
    L.items.sort((a, b) => a.x - b.x);
    L.cy = (L.y0 + L.y1) / 2;
    L.height = L.y1 - L.y0 + 1;
    L.medianHeight = median(L.items.map((c) => c.h));
  }
  return lines.sort((a, b) => a.cy - b.cy);
}

/**
 * Merge glyph components into word boxes inside a line. The gap threshold is
 * derived from the line's own median glyph height, so it scales with font size
 * instead of being a fixed pixel count.
 */
export function groupWords(line, { gapFactor = 0.6 } = {}) {
  const gapMax = Math.max(3, line.medianHeight * gapFactor);
  const words = [];
  let cur = null;
  for (const c of line.items) {
    if (cur && c.x - cur.x1 <= gapMax) {
      cur.x1 = Math.max(cur.x1, c.x1);
      cur.y = Math.min(cur.y, c.y);
      cur.y1 = Math.max(cur.y1, c.y1);
      cur.parts.push(c);
    } else {
      cur = { x: c.x, x1: c.x1, y: c.y, y1: c.y1, parts: [c] };
      words.push(cur);
    }
  }
  for (const w of words) {
    w.w = w.x1 - w.x + 1;
    w.h = w.y1 - w.y + 1;
    w.cx = w.x + w.w / 2;
    w.cy = w.y + w.h / 2;
  }
  return words;
}

export function median(values) {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Estimate page skew in degrees from the stage-06 orientation histogram. */
export function estimateSkew(hist, bins = hist.length) {
  // Horizontal edges put their gradient normal at 90 degrees.
  let best = 90, bestV = -1;
  const w = Math.round(bins / 12); // +-15 degrees search window
  for (let d = -w; d <= w; d++) {
    const b = (90 + d + bins) % bins;
    const v = hist[b];
    if (v > bestV) { bestV = v; best = 90 + d; }
  }
  // Parabolic refinement against the neighbouring bins.
  const at = (i) => hist[((i % bins) + bins) % bins];
  const y0 = at(best - 1), y1 = at(best), y2 = at(best + 1);
  const denom = y0 - 2 * y1 + y2;
  const delta = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const deg = best + delta - 90;
  return { skewDeg: +deg.toFixed(3), strength: bestV };
}
