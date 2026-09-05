/**
 * Rectification - recovering the page plane from GRIDLIFT's components.
 *
 * A photographed page is not merely rotated. Three distortions are stacked, and
 * they must be undone in this order because each one blinds the estimator for
 * the next:
 *
 *   1. quarter turn      the page is on its side (90/180/270)
 *   2. in-plane skew     it is a few degrees off square
 *   3. perspective       it was photographed at an angle, so parallel lines
 *                        converge and row pitch changes down the page
 *
 * (3) is the one a rotation cannot fix, and it is what the component overlay
 * shows: rows that *fan*. Only a homography removes it.
 *
 * The circularity that has to be broken: line clustering needs the skew, and
 * measuring skew normally needs lines. The way out is the nearest-neighbour
 * angle histogram - characters sit densely along their own baseline, so the
 * angle to a character's nearest right-hand neighbour peaks sharply at the
 * *local* baseline angle, with no grouping required. It is also local, which
 * means it survives perspective where a global estimate would smear.
 */

import { M, V, nullSpacePoint, normaliser, fitLine } from './linalg.js';
import { estimateOrientation, polarityScore, quarterTurnMatrix } from './orientation.js';
import { clusterLines, groupWords, median } from '../geometry.js';

export * from './linalg.js';
export * from './orientation.js';
export { warpCrop, warpCropToCanvas } from './warp.js';

/* ------------------------------------------------------------------ *
 * 1. Local skew, without needing lines
 * ------------------------------------------------------------------ */

/**
 * Histogram the angle from each glyph to its nearest right-hand neighbour.
 *
 * Anchored on the glyph *bottom*, not its centroid. Centroids sit at different
 * heights for 'o' and 'l' and land nowhere near each other for a full stop, so
 * a centroid-to-centroid angle carries the font's vertical metrics as noise -
 * enough to invent a third of a degree of skew on a perfectly square page.
 * Baselines are the invariant the text actually shares. Descenders still dip
 * below, but they are a minority and the *peak* of the histogram ignores them
 * where a mean would not.
 *
 * @param {{cx:number,y1:number,h:number,w:number}[]} glyphs
 * @param {{range?:number, binsPerDegree?:number, reach?:number}} opts
 */
export function neighbourAngleSkew(glyphs, { range = 30, binsPerDegree = 4, reach = 3.2 } = {}) {
  if (glyphs.length < 12) return { deg: 0, confidence: 0, samples: 0 };

  const medH = median(glyphs.map((g) => g.h)) || 10;
  const maxDist = medH * reach;

  // Bucket the glyphs so the neighbour search is local rather than O(n^2).
  const cell = Math.max(4, maxDist);
  const buckets = new Map();
  const key = (ix, iy) => `${ix},${iy}`;
  // Baseline anchor: bottom-centre of the glyph box.
  const anchored = glyphs.map((g) => ({ ax: g.cx, ay: g.y1 ?? g.cy, h: g.h }));
  for (const g of anchored) {
    const k = key(Math.floor(g.ax / cell), Math.floor(g.ay / cell));
    (buckets.get(k) ?? buckets.set(k, []).get(k)).push(g);
  }

  const bins = Math.round(range * 2 * binsPerDegree) + 1;
  const hist = new Float64Array(bins);
  let samples = 0;

  for (const g of anchored) {
    const bx = Math.floor(g.ax / cell);
    const by = Math.floor(g.ay / cell);
    let best = null;
    let bestD = Infinity;
    for (let dx = 0; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const o of buckets.get(key(bx + dx, by + dy)) ?? []) {
          if (o === g) continue;
          const vx = o.ax - g.ax;
          if (vx <= 0.5) continue;                       // strictly to the right
          // Glyphs of very different size (a full stop beside a capital) do not
          // share a reliable baseline relationship.
          if (Math.abs(o.h - g.h) > 0.4 * Math.max(o.h, g.h)) continue;
          const vy = o.ay - g.ay;
          const d = Math.hypot(vx, vy);
          if (d > maxDist || d < 1) continue;
          if (Math.abs(vy) > Math.abs(vx) * 1.2) continue; // not a baseline step
          if (d < bestD) { bestD = d; best = o; }
        }
      }
    }
    if (!best) continue;
    const deg = (Math.atan2(best.ay - g.ay, best.ax - g.ax) * 180) / Math.PI;
    if (Math.abs(deg) > range) continue;
    // Weight by distance: adjacent characters are far more reliable than the
    // next word over, and inter-word gaps carry the same baseline anyway.
    const w = 1 / (1 + bestD / medH);
    const pos = (deg + range) * binsPerDegree;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    if (i0 >= 0 && i0 < bins) hist[i0] += w * (1 - frac);
    if (i0 + 1 < bins) hist[i0 + 1] += w * frac;
    samples++;
  }

  if (samples < 10) return { deg: 0, confidence: 0, samples };

  // Smoothing kernel matters here. A single box pass turns a sharp peak into a
  // flat plateau, and picking the argmax of a plateau lands on its left edge -
  // a systematic bias of half the window, which shows up as a third of a degree
  // of skew on a page that has none. Two box passes give a triangular kernel
  // with a unique maximum, and the peak is then located by intensity-weighted
  // centroid rather than by argmax at all.
  const r = Math.max(1, Math.round(binsPerDegree * 0.5));
  const box = (src) => {
    const out = new Float64Array(bins);
    for (let i = 0; i < bins; i++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) {
        const j = i + d;
        if (j >= 0 && j < bins) { s += src[j]; n++; }
      }
      out[i] = s / n;
    }
    return out;
  };
  const sm = box(box(hist));

  let peak = 0;
  for (let i = 1; i < bins; i++) if (sm[i] > sm[peak]) peak = i;

  const wR = Math.max(2, Math.round(binsPerDegree * 1.5));
  let num = 0, den = 0;
  for (let i = peak - wR; i <= peak + wR; i++) {
    if (i < 0 || i >= bins) continue;
    num += i * sm[i];
    den += sm[i];
  }
  const centre = den > 0 ? num / den : peak;
  const deg = centre / binsPerDegree - range;

  let total = 0;
  for (const v of sm) total += v;
  const sharpness = total > 0 ? (den / (2 * wR + 1)) * (2 * r + 1) / total : 0;

  return {
    deg: +deg.toFixed(4),
    confidence: +Math.min(1, sharpness * 6).toFixed(3),
    samples,
  };
}

/* ------------------------------------------------------------------ *
 * 2. The two line families
 * ------------------------------------------------------------------ */

/**
 * Text baselines, fitted in a frame where the skew has been removed so that
 * clustering works, then reported in the original coordinates.
 */
export function horizontalFamily(components, { skewDeg = 0, minWords = 3, maxRms = 2.5 } = {}) {
  const rad = (-skewDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rotated = components
    .filter((c) => c.isText)
    .map((c) => {
      const x = c.cx * cos - c.cy * sin;
      const y = c.cx * sin + c.cy * cos;
      return { ...c, cx: x, cy: y, x, y: y - c.h / 2, x1: x + c.w, y1: y + c.h / 2, _src: c };
    });

  const lines = clusterLines(rotated);
  const fits = [];
  for (const L of lines) {
    if (L.items.length < minWords * 2) continue;
    // Fit through the *original* centroids, so the fit lives in image space.
    const pts = L.items.map((c) => [c._src.cx, c._src.cy]);
    const f = fitLine(pts);
    if (!f) continue;
    if (f.rms > maxRms) continue;
    if (f.span < 40) continue;
    fits.push({ ...f, weight: Math.min(1, f.count / 12) * Math.min(1, f.span / 200) });
  }
  return { fits, lines, rotated };
}

/**
 * Column edges, found by RANSAC over word left/right edges.
 *
 * Clustering edges by x would be simpler and is what a non-perspective pipeline
 * does, but under keystone a single column drifts sideways by more than the
 * gap between columns, so the clusters merge. Fitting actual lines makes no
 * assumption about verticality at all.
 */
export function verticalFamily(hLines, {
  iterations = 240,
  tol = 3,
  minLines = 4,
  minSpanRatio = 0.18,
  maxFamilies = 16,
  height = 1000,
  toImage = null,
} = {}) {
  // `hLines` live in the deskewed frame that made clustering possible; the fits
  // have to come back to image space or they cannot be mixed with the text-line
  // fits when the vanishing point is estimated.
  const map = toImage ? (x, y) => M.apply(toImage, x, y) : (x, y) => [x, y];
  const pts = [];
  hLines.forEach((L, li) => {
    for (const w of groupWords(L)) {
      const a = map(w.x, w.cy);
      const b = map(w.x1, w.cy);
      pts.push({ x: a[0], y: a[1], line: li, kind: 'left' });
      pts.push({ x: b[0], y: b[1], line: li, kind: 'right' });
    }
  });
  if (pts.length < minLines * 2) return { fits: [], points: pts };

  const minSpan = height * minSpanRatio;
  const remaining = new Set(pts.keys());
  const fits = [];

  for (let fam = 0; fam < maxFamilies && remaining.size >= minLines; fam++) {
    const pool = [...remaining];
    let best = null;

    for (let it = 0; it < iterations; it++) {
      const a = pts[pool[(Math.random() * pool.length) | 0]];
      const b = pts[pool[(Math.random() * pool.length) | 0]];
      if (a === b || a.line === b.line || a.kind !== b.kind) continue;
      const dy = b.y - a.y;
      if (Math.abs(dy) < minSpan) continue;

      const dx = b.x - a.x;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;      // unit normal
      const c = -(nx * a.x + ny * a.y);

      const inliers = [];
      const seen = new Set();
      for (const idx of pool) {
        const p = pts[idx];
        if (p.kind !== a.kind) continue;
        if (Math.abs(nx * p.x + ny * p.y + c) > tol) continue;
        inliers.push(idx);
        seen.add(p.line);
      }
      if (seen.size < minLines) continue;
      const score = seen.size + inliers.length * 0.01;
      if (!best || score > best.score) best = { score, inliers, lines: seen.size };
    }

    if (!best) break;
    const f = fitLine(best.inliers.map((i) => [pts[i].x, pts[i].y]));
    if (f && f.rms <= tol && f.span >= minSpan * 0.8) {
      fits.push({ ...f, weight: Math.min(1, best.lines / 10), lines: best.lines });
    }
    for (const i of best.inliers) remaining.delete(i);
  }

  return { fits, points: pts };
}

/** Turn detected rules into line fits so they join the appropriate family. */
export function rulesAsFits(segs, axis) {
  return segs
    .filter((s) => !s.decorative && s.tableness > 0.3 && s.length > 40)
    .map((s) => {
      const p1 = axis === 'h' ? [s.x0, s.y] : [s.x, s.y0];
      const p2 = axis === 'h' ? [s.x1, s.y] : [s.x, s.y1];
      const f = fitLine([p1, p2]);
      return f && { ...f, weight: Math.min(1, s.length / 300) * 1.5, fromRule: true };
    })
    .filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * 3. Vanishing points
 * ------------------------------------------------------------------ */

/**
 * RANSAC + least-squares vanishing point.
 *
 * The residual is angular, not algebraic: for each fit, the line joining its
 * midpoint to the candidate vanishing point should be parallel to the fit's own
 * direction. That formulation stays well-behaved when the vanishing point runs
 * off to infinity, which is exactly what happens on a nearly-square photo - and
 * a squared-algebraic residual would blow up there.
 */
export function estimateVanishingPoint(fits, { iterations = 400, tolDeg = 1.2, norm } = {}) {
  if (fits.length < 2) return null;

  const T = norm?.T ?? M.identity();
  const local = fits.map((f) => {
    const a = M.apply(T, f.mid[0], f.mid[1]);
    const b = M.apply(T, f.mid[0] + f.dir[0] * 10, f.mid[1] + f.dir[1] * 10);
    const d = [b[0] - a[0], b[1] - a[1]];
    const dn = Math.hypot(d[0], d[1]) || 1;
    return {
      mid: [a[0], a[1], 1],
      dir: [d[0] / dn, d[1] / dn],
      line: V.unitLine(V.cross([a[0], a[1], 1], [b[0], b[1], 1])),
      weight: f.weight ?? 1,
      src: f,
    };
  });

  const tol = (tolDeg * Math.PI) / 180;
  const residual = (cand, f) => {
    // Line from this fit's midpoint to the candidate point.
    const join = V.cross(f.mid, cand);
    const n = Math.hypot(join[0], join[1]);
    if (n < 1e-12) return Math.PI;                 // midpoint *is* the point
    const jd = [-join[1] / n, join[0] / n];        // direction along that line
    const dot = Math.abs(jd[0] * f.dir[0] + jd[1] * f.dir[1]);
    return Math.acos(Math.min(1, dot));
  };

  let best = null;
  for (let it = 0; it < iterations; it++) {
    const a = local[(Math.random() * local.length) | 0];
    const b = local[(Math.random() * local.length) | 0];
    if (a === b) continue;
    const cand = V.unit(V.cross(a.line, b.line));
    if (V.norm(cand) < 1e-9) continue;
    let score = 0, count = 0;
    for (const f of local) {
      if (residual(cand, f) < tol) { score += f.weight; count++; }
    }
    if (count >= 2 && (!best || score > best.score)) best = { cand, score, count };
  }
  if (!best) return null;

  // Refine on the inliers.
  const inliers = local.filter((f) => residual(best.cand, f) < tol * 1.5);
  const refined = inliers.length >= 2
    ? V.unit(nullSpacePoint(inliers.map((f) => f.line)))
    : best.cand;

  const point = norm ? M.applyH(norm.Tinv, refined) : refined;
  const eu = V.euclid(point, 1e-7);
  const rms = Math.sqrt(
    inliers.reduce((s, f) => s + residual(refined, f) ** 2, 0) / Math.max(1, inliers.length),
  );

  return {
    point,                       // homogeneous, in original image coordinates
    euclidean: eu,               // null when at (or effectively at) infinity
    inliers: inliers.length,
    total: fits.length,
    rmsDeg: +((rms * 180) / Math.PI).toFixed(3),
    support: +(inliers.length / fits.length).toFixed(3),
  };
}

/* ------------------------------------------------------------------ *
 * 4. The rectifying homography
 * ------------------------------------------------------------------ */

/**
 * Two orthogonal vanishing points plus square pixels determine the focal
 * length: f^2 = -(vh - c) . (vv - c), with c the principal point. That single
 * extra number is what makes the rectification *metric* - without it the page
 * comes back straight but stretched along one axis, which is survivable for
 * OCR and wrong for anything measuring the page.
 *
 * With f, the camera is rotated to face the plane: H = R^T K^-1, where R's
 * columns are the two page directions and their cross product.
 */
export function rectifyingHomography(vh, vv, { width, height, targetAspect = null } = {}) {
  const cx = width / 2;
  const cy = height / 2;
  const diag = Math.hypot(width, height);

  const farAway = (p) => {
    const e = V.euclid(p, 1e-9);
    return !e || Math.hypot(e[0] - cx, e[1] - cy) > diag * 40;
  };

  const hInf = !vh || farAway(vh.point);
  const vInf = !vv || farAway(vv.point);

  // Direction of each family, valid whether or not its vanishing point is finite.
  const dirOf = (vp, fallback) => {
    if (!vp) return fallback;
    const e = V.euclid(vp.point, 1e-9);
    if (e) {
      const d = [e[0] - cx, e[1] - cy];
      const n = Math.hypot(d[0], d[1]) || 1;
      return [d[0] / n, d[1] / n];
    }
    const n = Math.hypot(vp.point[0], vp.point[1]) || 1;
    return [vp.point[0] / n, vp.point[1] / n];
  };

  let H;
  let method;

  if (!hInf && !vInf) {
    const eh = V.euclid(vh.point);
    const ev = V.euclid(vv.point);
    const f2 = -((eh[0] - cx) * (ev[0] - cx) + (eh[1] - cy) * (ev[1] - cy));
    if (f2 > (diag * 0.05) ** 2) {
      const f = Math.sqrt(f2);
      const Kinv = Float64Array.from([1 / f, 0, -cx / f, 0, 1 / f, -cy / f, 0, 0, 1]);
      let r1 = V.unit(M.applyH(Kinv, [eh[0], eh[1], 1]));
      let r2 = V.unit(M.applyH(Kinv, [ev[0], ev[1], 1]));
      // Gram-Schmidt: enforce the right angle the paper actually has.
      const proj = V.dot(r2, r1);
      r2 = V.unit([r2[0] - proj * r1[0], r2[1] - proj * r1[1], r2[2] - proj * r1[2]]);
      const r3 = V.cross(r1, r2);
      H = Float64Array.from([
        r1[0], r1[1], r1[2],
        r2[0], r2[1], r2[2],
        r3[0], r3[1], r3[2],
      ]);
      H = M.mul(H, Kinv);
      method = `metric (f=${f.toFixed(1)}px)`;
    }
  }

  if (!H) {
    // Fallback: kill the projective part with the horizon, then square up the
    // two directions affinely. Angles come out right, absolute aspect does not.
    const dh = dirOf(vh, [1, 0]);
    const dv = dirOf(vv, [0, 1]);
    let Hp = M.identity();
    if (!hInf || !vInf) {
      const l = V.unitLine(V.cross(
        vh?.point ?? [dh[0], dh[1], 0],
        vv?.point ?? [dv[0], dv[1], 0],
      ));
      if (Math.abs(l[2]) > 1e-9) {
        Hp = Float64Array.from([1, 0, 0, 0, 1, 0, l[0] / l[2], l[1] / l[2], 1]);
      }
    }
    const th = V.unit(M.applyH(Hp, vh?.point ?? [dh[0], dh[1], 0]));
    const tv = V.unit(M.applyH(Hp, vv?.point ?? [dv[0], dv[1], 0]));
    const D = [[th[0], tv[0]], [th[1], tv[1]]];
    const det = D[0][0] * D[1][1] - D[0][1] * D[1][0];
    const A = Math.abs(det) > 1e-9
      ? [[D[1][1] / det, -D[0][1] / det], [-D[1][0] / det, D[0][0] / det]]
      : [[1, 0], [0, 1]];
    const Ha = Float64Array.from([A[0][0], A[0][1], 0, A[1][0], A[1][1], 0, 0, 0, 1]);
    H = M.mul(Ha, Hp);
    method = hInf && vInf ? 'affine (no perspective detected)' : 'algebraic two-point';
  }

  // Keep the page in front of the camera and the reading direction intact.
  const wAt = (x, y) => H[6] * x + H[7] * y + H[8];
  if (wAt(cx, cy) < 0) for (let i = 0; i < 9; i++) H[i] = -H[i];

  const p0 = M.apply(H, cx - width * 0.2, cy);
  const p1 = M.apply(H, cx + width * 0.2, cy);
  if (p1[0] < p0[0]) H = M.mul(M.scale(-1, 1), H);
  const q0 = M.apply(H, cx, cy - height * 0.2);
  const q1 = M.apply(H, cx, cy + height * 0.2);
  if (q1[1] < q0[1]) H = M.mul(M.scale(1, -1), H);

  if (targetAspect) {
    // Force a known page aspect (A4 portrait = 1 / sqrt(2)).
    const corners = [[0, 0], [width, 0], [width, height], [0, height]].map((p) => M.apply(H, p[0], p[1]));
    const w = Math.max(...corners.map((c) => c[0])) - Math.min(...corners.map((c) => c[0]));
    const h = Math.max(...corners.map((c) => c[1])) - Math.min(...corners.map((c) => c[1]));
    if (w > 0 && h > 0) H = M.mul(M.scale(1, (w / h) / targetAspect), H);
  }

  return { H, method, horizontalAtInfinity: hInf, verticalAtInfinity: vInf };
}

/**
 * Compose a similarity that puts the rectified content in an output raster of
 * the requested size, preserving aspect.
 */
export function frameHomography(H, quad, { maxDim = 1800, pad = 0.01 } = {}) {
  const pts = quad.map((p) => M.apply(H, p[0], p[1]));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  if (!(w > 0 && h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;

  minX -= w * pad; maxX += w * pad;
  minY -= h * pad; maxY += h * pad;
  const bw = maxX - minX, bh = maxY - minY;

  const scale = maxDim / Math.max(bw, bh);
  const outW = Math.max(16, Math.round(bw * scale) & ~1);
  const outH = Math.max(16, Math.round(bh * scale) & ~1);
  const S = M.mul(M.scale(scale), M.translate(-minX, -minY));
  return { H: M.mul(S, H), width: outW, height: outH };
}


/* ------------------------------------------------------------------ *
 * Measuring flatness
 * ------------------------------------------------------------------ */

/** Project component boxes through a homography, re-deriving axis-aligned boxes. */
export function applyToComponents(components, H) {
  return components.map((c) => {
    const pts = [[c.x, c.y], [c.x1, c.y], [c.x1, c.y1], [c.x, c.y1]]
      .map((p) => M.apply(H, p[0], p[1]));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    return { ...c, x, y, w, h, x1: x + w, y1: y + h, cx: x + w / 2, cy: y + h / 2 };
  });
}

/**
 * How flat is this page, really?
 *
 * Three numbers, each measuring a distortion the correction is supposed to
 * remove: lines not horizontal (skew), lines not parallel to each other (a
 * vanishing point along the text), and row pitch drifting down the page (a
 * vanishing point across it). Pitch *variance* would be the obvious metric and
 * is the wrong one - an invoice's own paragraph gaps dominate it and say
 * nothing about perspective; the drift between the top and bottom half of the
 * page isolates the part that perspective caused.
 *
 * This is what lets rectification be chosen by evidence rather than asserted:
 * a candidate homography is applied only if it measurably flattens the page.
 */
export function evaluateFlatness(components) {
  const lines = clusterLines(components.filter((c) => c.isText)).filter((L) => L.items.length >= 6);
  if (lines.length < 3) return { lines: lines.length, cost: Infinity, meanAbsAngleDeg: 90, angleSpreadDeg: 90, pitchDrift: 1 };

  const angles = [];
  const centres = [];
  for (const L of lines) {
    const f = fitLine(L.items.map((c) => [c.cx, c.cy]));
    if (!f) continue;
    let a = (Math.atan2(f.dir[1], f.dir[0]) * 180) / Math.PI;
    if (a > 90) a -= 180;
    if (a < -90) a += 180;
    angles.push(a);
    centres.push(L.cy);
  }
  if (angles.length < 3) return { lines: angles.length, cost: Infinity, meanAbsAngleDeg: 90, angleSpreadDeg: 90, pitchDrift: 1 };

  const mean = angles.reduce((s, v) => s + v, 0) / angles.length;
  const spread = Math.sqrt(angles.reduce((s, v) => s + (v - mean) ** 2, 0) / angles.length);
  const meanAbs = angles.reduce((s, v) => s + Math.abs(v), 0) / angles.length;

  centres.sort((a, b) => a - b);
  const pitches = [];
  for (let i = 1; i < centres.length; i++) {
    const d = centres[i] - centres[i - 1];
    if (d > 4) pitches.push({ d, y: (centres[i] + centres[i - 1]) / 2 });
  }
  const mid = (centres[0] + centres[centres.length - 1]) / 2;
  const med = (arr) => (arr.length ? [...arr].sort((a, b) => a - b)[arr.length >> 1] : 0);
  const top = med(pitches.filter((p) => p.y < mid).map((p) => p.d));
  const bot = med(pitches.filter((p) => p.y >= mid).map((p) => p.d));
  const pitchDrift = top > 0 && bot > 0 ? Math.abs(Math.log(bot / top)) : 0;

  return {
    lines: angles.length,
    meanAbsAngleDeg: +meanAbs.toFixed(4),
    angleSpreadDeg: +spread.toFixed(4),
    pitchDrift: +pitchDrift.toFixed(4),
    cost: +(meanAbs + 2 * spread + 25 * pitchDrift).toFixed(4),
  };
}

/** One estimation round: families -> vanishing points -> homography. */
function planePass(comps, width, height, segments, options) {
  const skew = neighbourAngleSkew(comps.filter((c) => c.isText));
  const { fits: textFits, lines } = horizontalFamily(comps, { skewDeg: skew.deg });

  const ruleFits = [...(segments.hFits ?? []), ...(segments.vFits ?? [])];
  const horizontalish = (f) => Math.abs(f.dir[0]) >= Math.abs(f.dir[1]);
  const hFits = [...textFits, ...ruleFits].filter(horizontalish);
  const { fits: colFits } = verticalFamily(lines, {
    height,
    toImage: M.rotate((skew.deg * Math.PI) / 180),
  });
  const vFits = [...colFits, ...ruleFits.filter((f) => !horizontalish(f))];

  const norm = normaliser(width, height);
  const vh = estimateVanishingPoint(hFits, { norm });
  const vv = estimateVanishingPoint(vFits, { norm });
  const built = rectifyingHomography(vh, vv, {
    width, height, targetAspect: options.targetAspect ?? null,
  });
  return { ...built, skew, hFits, vFits, vh, vv, lines };
}

const contentQuad = (comps, w, h) => {
  const texts = comps.filter((c) => c.isText);
  if (!texts.length) return [[0, 0], [w, 0], [w, h], [0, h]];
  const pad = Math.max(w, h) * 0.04;
  const x0 = Math.min(...texts.map((c) => c.x)) - pad;
  const x1 = Math.max(...texts.map((c) => c.x1)) + pad;
  const y0 = Math.min(...texts.map((c) => c.y)) - pad;
  const y1 = Math.max(...texts.map((c) => c.y1)) + pad;
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
};

/* ------------------------------------------------------------------ *
 * 5. Top level
 * ------------------------------------------------------------------ */

/**
 * Estimate the full source -> rectified transform from a GRIDLIFT pass.
 *
 * @param {object} raw     result of `runGpuStages` (or a synthetic equivalent)
 * @param {object[]} components decoded components in working coordinates
 * @param {{hSegs?:object[], vSegs?:object[]}} segments
 * @returns {{
 *   quarterTurns:number, skewDeg:number,
 *   H:Float64Array,            source pixels -> rectified pixels
 *   Hinv:Float64Array,         rectified pixels -> source pixels (for sampling)
 *   width:number, height:number,
 *   quality:object, diagnostics:object
 * }}
 */
export function estimateRectification(raw, components, segments = {}, options = {}) {
  const {
    maxDim = raw.sourceWidth ? Math.max(raw.sourceWidth, raw.sourceHeight) : 1800,
    targetAspect = null,
    rounds = 2,
    minGain = 0.05,
  } = options;

  const width = raw.width;
  const height = raw.height;
  const scale = raw.scale ?? 1;

  // --- quarter turn --------------------------------------------------------
  const orientation = estimateOrientation(components, { width, height });
  const turns = orientation.quarterTurns;
  const Q = quarterTurnMatrix(turns, width, height);
  const turned = applyToComponents(components, Q);
  const tW = turns % 2 ? height : width;
  const tH = turns % 2 ? width : height;

  // Rules, mapped into the turned frame and re-sorted by their actual
  // direction: a quarter turn swaps which axis a rule belongs to.
  const turnSeg = (seg, axis) => {
    const a = M.apply(Q, axis === 'h' ? seg.x0 : seg.x, axis === 'h' ? seg.y : seg.y0);
    const b = M.apply(Q, axis === 'h' ? seg.x1 : seg.x, axis === 'h' ? seg.y : seg.y1);
    const f = fitLine([a, b]);
    return f && { ...f, weight: Math.min(1, seg.length / 300) * 1.5, fromRule: true };
  };
  const usable = (s2) => !s2.decorative && s2.tableness > 0.3 && s2.length > 40;
  const ruleFits = [
    ...(segments.hSegs ?? []).filter(usable).map((x) => turnSeg(x, 'h')),
    ...(segments.vSegs ?? []).filter(usable).map((x) => turnSeg(x, 'v')),
  ].filter(Boolean);
  const isH = (f) => Math.abs(f.dir[0]) >= Math.abs(f.dir[1]);
  const segFits = { hFits: ruleFits.filter(isH), vFits: ruleFits.filter((f) => !isH(f)) };

  const baseline = evaluateFlatness(turned);

  // --- iterate: estimate, apply, re-estimate on the flatter page ------------
  // A second round is not a refinement flourish. The first estimate is made
  // from line fits through a curved page, where every fit is slightly wrong in
  // the same direction; once the bulk of the distortion is gone the fits are
  // clean and the residual perspective can be measured properly. Each round is
  // kept only if it measurably flattens the page.
  let acc = M.identity();
  let frameComps = turned;
  let frameW = tW;
  let frameH = tH;
  let bestCost = baseline.cost;
  let bestH = null;
  let bestMethod = 'none';
  let passes = [];
  let lastPass = null;

  for (let round = 0; round < rounds; round++) {
    const pass = planePass(frameComps, frameW, frameH, round === 0 ? segFits : {}, { targetAspect });
    lastPass ??= pass;
    const framed = frameHomography(pass.H, contentQuad(frameComps, frameW, frameH), { maxDim });
    if (!framed) break;

    const candidate = M.mul(framed.H, acc);
    const projected = applyToComponents(turned, candidate);
    const flat = evaluateFlatness(projected);
    passes.push({ round, method: pass.method, cost: flat.cost, ...flat });

    if (!(flat.cost < bestCost * (1 - minGain))) break;
    bestCost = flat.cost;
    bestH = candidate;
    bestMethod = round === 0 ? pass.method : `${bestMethod} + refined`;
    acc = candidate;
    frameComps = projected;
    frameW = framed.width;
    frameH = framed.height;
  }

  // --- a pure rotation is sometimes the honest answer ----------------------
  const skew = lastPass?.skew ?? neighbourAngleSkew(turned.filter((c) => c.isText));
  if (Math.abs(skew.deg) > 0.05) {
    const rad = (-skew.deg * Math.PI) / 180;
    const rot = M.mul(M.translate(tW / 2, tH / 2), M.mul(M.rotate(rad), M.translate(-tW / 2, -tH / 2)));
    const framedRot = frameHomography(rot, contentQuad(turned, tW, tH), { maxDim });
    if (framedRot) {
      const flat = evaluateFlatness(applyToComponents(turned, framedRot.H));
      passes.push({ round: 'rotation-only', method: 'rotation', cost: flat.cost, ...flat });
      if (flat.cost < bestCost * (1 - minGain)) {
        bestCost = flat.cost;
        bestH = framedRot.H;
        bestMethod = 'rotation only';
        frameW = framedRot.width;
        frameH = framedRot.height;
      }
    }
  }

  if (!bestH) {
    // Nothing beat leaving the page alone (beyond the quarter turn, if any).
    const framedId = frameHomography(M.identity(), contentQuad(turned, tW, tH), { maxDim });
    bestH = framedId ? framedId.H : M.identity();
    bestMethod = 'none (page already flat)';
    if (framedId) { frameW = framedId.width; frameH = framedId.height; }
  }

  // Compose back to SOURCE pixels: source -> working -> turned -> rectified.
  const H = M.mul(bestH, M.mul(Q, M.scale(scale)));
  const Hinv = M.inverse(H);
  if (!Hinv) return failed(orientation, skew, 'singular homography');

  const final = evaluateFlatness(applyToComponents(turned, bestH));

  return {
    ok: true,
    quarterTurns: turns,
    skewDeg: skew.deg,
    H,
    Hinv,
    width: frameW,
    height: frameH,
    method: bestMethod,
    quality: {
      before: baseline,
      after: final,
      gain: +(1 - final.cost / Math.max(baseline.cost, 1e-6)).toFixed(3),
      lineAngleSpreadBefore: baseline.angleSpreadDeg,
      lineAngleSpreadAfter: final.angleSpreadDeg,
      meanResidualAfterDeg: final.meanAbsAngleDeg,
      pitchDriftBefore: baseline.pitchDrift,
      pitchDriftAfter: final.pitchDrift,
      perspectiveStrength: +(
        Math.hypot(bestH[6], bestH[7]) * Math.hypot(tW, tH) / Math.abs(bestH[8] || 1)
      ).toFixed(5),
    },
    diagnostics: {
      orientation,
      skew,
      passes,
      horizontalFits: lastPass?.hFits.length ?? 0,
      verticalFits: lastPass?.vFits.length ?? 0,
      vanishingHorizontal: lastPass?.vh && {
        euclidean: lastPass.vh.euclidean, support: lastPass.vh.support, rmsDeg: lastPass.vh.rmsDeg,
      },
      vanishingVertical: lastPass?.vv && {
        euclidean: lastPass.vv.euclidean, support: lastPass.vv.support, rmsDeg: lastPass.vv.rmsDeg,
      },
      horizontalAtInfinity: lastPass?.horizontalAtInfinity,
      verticalAtInfinity: lastPass?.verticalAtInfinity,
    },
  };
}

function failed(orientation, skew, reason) {
  return {
    ok: false,
    reason,
    quarterTurns: orientation.quarterTurns,
    skewDeg: skew.deg,
    H: M.identity(),
    Hinv: M.identity(),
    diagnostics: { orientation, skew },
  };
}

/** Column-major 3x3 for a WGSL `mat3x3<f32>` uniform (vec3 padded to 16 B). */
export function toWgslMat3(H) {
  const out = new Float32Array(12);
  for (let c = 0; c < 3; c++) {
    out[c * 4 + 0] = H[0 * 3 + c];
    out[c * 4 + 1] = H[1 * 3 + c];
    out[c * 4 + 2] = H[2 * 3 + c];
    out[c * 4 + 3] = 0;
  }
  return out;
}

/** Convenience: does this page need rectifying at all? */
export function needsRectification(est, { skewTolDeg = 0.3, minGain = 0.15 } = {}) {
  if (!est.ok) return false;
  if (est.quarterTurns !== 0) return true;
  if (Math.abs(est.skewDeg) > skewTolDeg) return true;
  // Warping costs a whole second GPU pass and a second set of OCR crops. It is
  // only worth it if the measurement says the page actually got flatter.
  return est.quality.gain > minGain;
}
