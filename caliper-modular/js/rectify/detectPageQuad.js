/* detectPageQuad.js
   Locate the four corners of a document page in a canvas.

   detectPageQuad(canvas [, opts]) -> {tl, tr, br, bl} in full-resolution
   canvas coordinates (clockwise, y down), or null when no clear page is found.

   Pipeline
     1. Downscale to ~900 px, convert to Y/Cb/Cr, blur lightly.
     2. Paper reference colour = the dominant luma mode of the frame centre
        (robust to text, tables and photos), then a "distance to paper colour"
        map. Colour + luma separates paper from a desk far better than a global
        luma threshold and is much less sensitive to shadows.
     3. Candidate segmentations, tried in order until one scores well:
          - distance map thresholded at Otsu (on a log scale, so ink does not
            hijack the split) x 1 / 0.7 / 1.4, floored at 3x the paper noise;
          - region growing from the centre over low-gradient pixels, which
            survives lighting gradients that defeat any global threshold;
          - the legacy luma-Otsu mask.
        Each mask is hole-filled (print becomes paper), opened (thin bridges to
        a bright background are cut) and reduced to the component under the
        frame centre.
     4. Boundary -> convex hull -> max-area inscribed quad -> total-least-squares
        line fit per edge -> corners from line intersections. Candidates are
        scored by convexity x quad fill x edge contrast, and shape-validated
        (convex, plausible angles, real contrast step on every visible edge).
     5. Sub-pixel refinement at (near) full resolution: along each edge the
        colour profile is sampled across the edge, the strongest paper-to-
        background step is located with parabolic interpolation, and a
        RANSAC + least-squares line is fitted through those edge points. Corners
        are the intersections of the refined lines. This removes the ~1/scale px
        quantisation error of working on the downscaled image.
     6. Edge recovery: an edge with no image evidence at its rough position
        (the segmentation merged the page with a reflection, a second sheet or
        a white wall), or whose line fit failed (rough edge rotated against the
        true one), is swept for the outermost straight line most samples agree
        on. The line replaces the rough edge only if it separates paper from
        non-paper and the strip it crosses is not paper-coloured, so a page
        that simply continues to the frame border, or a table rule inside a
        full-frame scan, is left alone.

   opts: workSize (900), minAreaFrac (0.40), refine (true), maxRefinePixels
   (24e6), debug (array to receive diagnostics). */

export function detectPageQuad(canvas, opts = {}) {
  const o = Object.assign({
    workSize: 900,          // long side of the segmentation image, px
    minAreaFrac: 0.40,      // page must cover this fraction of the frame
    refine: true,           // sub-pixel edge refinement at high resolution
    maxRefinePixels: 24e6,  // refinement image is capped at this many pixels
    debug: null,            // pass an array to receive per-candidate diagnostics
  }, opts);
  const log = o.debug ? (...a) => o.debug.push(a.join(' ')) : () => {};
  const now = typeof performance !== 'undefined' ? () => performance.now() : Date.now;
  const T0 = now(), tick = what => log(what, 'at', (now() - T0).toFixed(0) + 'ms');

  const CW = canvas.width, CH = canvas.height;
  if (CW < 32 || CH < 32) return null;

  /* 1. segmentation image + features ------------------------------------ */
  const sc = Math.min(1, o.workSize / Math.max(CW, CH));
  const w = Math.max(32, Math.round(CW * sc)), h = Math.max(32, Math.round(CH * sc)), N = w * h;
  const px = readPixels(canvas, w, h);
  const f = toYCbCr(px, N);
  const Y = box3(f.Y, w, h), Cb = box3(f.Cb, w, h), Cr = box3(f.Cr, w, h);

  // paper reference colour: the dominant luma mode of the central window
  // (the median fails when text, tables or a photo cover half the window),
  // then per-channel medians over the pixels belonging to that mode
  const win = [(w * 0.35) | 0, (w * 0.65) | 0, (h * 0.35) | 0, (h * 0.65) | 0];
  const paper = paperPixels(Y, w, win);
  const ref = [medianOf(Y, paper), medianOf(Cb, paper), medianOf(Cr, paper)];

  // distance-to-paper map. The threshold comes from Otsu on a log-compressed
  // copy: on a linear scale dark ink (distance ~255) dominates the variance
  // and Otsu then separates ink from "paper + desk" instead of paper from desk.
  const D = new Uint8Array(N), Dlog = new Uint8Array(N), LOG = 255 / Math.log(256);
  for (let i = 0; i < N; i++) {
    D[i] = paperDist(Y[i], Cb[i], Cr[i], ref);
    Dlog[i] = Math.log(1 + D[i]) * LOG;
  }
  const tOtsu = Math.exp(otsu(Dlog) / LOG) - 1;
  // noise floor: paper pixels have |noise|-like distances, sigma ~ 1.48 x median
  const nD = 1.4826 * (medianOf(D, paper) + 0.5);
  const tD = Math.max(3, tOtsu, 3 * nD);
  const sd = diffNoise(Y, paper);
  tick('features');
  log('ref', ref.join(','), 'paper px', paper.length, 'tOtsu', tOtsu.toFixed(1), 'noise', nD.toFixed(1), 'tD', tD.toFixed(1), 'diff noise', sd.toFixed(2));

  /* 2. candidate segmentations ------------------------------------------ */
  // Candidates are tried from most to least likely and the search stops as
  // soon as one scores >= GOOD: the refinement stage only needs a rough quad
  // within a few pixels of the page, so later candidates cannot improve on it.
  const GOOD = 0.95;
  const cands = [];
  const done = () => cands.length && cands[0].score >= GOOD && !cands[0].weak;
  const consider = (mask, tag) => {
    const c = quadFromMask(mask, w, h, o.minAreaFrac, (...m) => log(tag + ':', ...m));
    if (!c) return;
    // visible edges must show real image evidence (a colour step or a thin
    // edge line); this rejects bands produced by thresholding a smooth
    // lighting gradient. One visible edge may be weak: a second sheet under
    // the page or a bright reflection can hide most of an edge.
    const ec = edgeContrast(Y, Cb, Cr, D, w, h, c.quad, 3);
    log(tag + ': conv*fill', c.score.toFixed(3), 'edges', ec.inFrame, 'strong', ec.strong, 'steps', ec.steps.map(v => v.toFixed(1)).join('/'));
    if (ec.inFrame < 2 || ec.strong < Math.max(2, ec.inFrame - 1)) return;
    c.score *= Math.min(1, ec.meanStep / Math.max(10, 0.5 * tD));
    c.weak = ec.strong < ec.inFrame;
    c.weakEdge = ec.edge.map(v => v !== null && v < 6);
    if (c.weak) c.score *= 0.85;                         // never beats a candidate with all edges seen
    c.tag = tag; cands.push(c);
    cands.sort((a, b) => (b.score - a.score) || (a.area - b.area));
  };
  const tried = [];
  for (const k of [1, 0.7, 1.4]) {
    if (done()) break;
    const t = Math.max(tD * k, 3 * nD);
    if (tried.some(u => Math.abs(u - t) < 0.1 * t)) continue;   // collapsed onto the noise floor
    tried.push(t);
    const m = new Uint8Array(N);
    for (let i = 0; i < N; i++) m[i] = D[i] <= t ? 1 : 0;
    consider(m, 'dist' + k);
    tick('dist' + k);
  }
  if (!done()) {
    // region growing from the centre over low-gradient pixels: immune to the
    // smooth lighting gradients that defeat any global threshold. Gradient
    // magnitude is isotropic; a plain neighbour-difference test leaks through
    // edges that run at a shallow angle to the pixel grid.
    const G = gradMag(Y, Cb, Cr, w, h);
    consider(growFromCentre(G, D, w, h, win, Math.max(2, 3.5 * sd)), 'grow-tight');
    if (!done()) consider(growFromCentre(G, D, w, h, win, Math.max(3, 6 * sd)), 'grow-loose');
    tick('grow');
  }
  if (!done()) {
    const tY = otsu(Y); let br = 0, dk = 0;
    for (let y = win[2]; y < win[3]; y++)
      for (let x = win[0]; x < win[1]; x++) (Y[y * w + x] > tY ? br++ : dk++);
    const bright = br >= dk, m = new Uint8Array(N);
    for (let i = 0; i < N; i++) m[i] = ((Y[i] > tY) === bright) ? 1 : 0;
    consider(m, 'luma');
    tick('luma');
  }
  if (!cands.length) return null;
  log('winner', cands[0].tag, cands[0].score.toFixed(3),
      'others', cands.slice(1).map(c => c.tag + '=' + c.score.toFixed(3)).join(' '));
  const quad = cands[0].quad, weakEdge = cands[0].weakEdge; // low-res, [tl,tr,br,bl]

  /* 3. sub-pixel refinement at high resolution --------------------------- */
  if (o.refine) {
    let sc2 = Math.min(1, Math.sqrt(o.maxRefinePixels / (CW * CH))), px2 = px, W2 = w, H2 = h;
    if (sc2 > sc * 1.1) {
      W2 = Math.max(32, Math.round(CW * sc2)); H2 = Math.max(32, Math.round(CH * sc2));
      px2 = readPixels(canvas, W2, H2);
    } else sc2 = sc;                                     // refine on the analysis image itself
    const k = sc2 / sc;
    const qr = quad.map(p => ({ x: p.x * k, y: p.y * k }));
    const R = Math.min(80, Math.max(6, Math.round(3 * k) + 3));
    const minG = Math.max(4, 0.1 * tD);
    tick('refine image read');
    const refined = refineEdges(px2, W2, H2, qr, ref, R, minG, weakEdge, log);
    tick('refine');
    if (refined && validQuad(refined, 0.04 * Math.hypot(W2, H2))) return toResult(refined, 1 / sc2);
    log('refinement rejected, using rough quad');
  }
  return toResult(quad, 1 / sc);
}

/* ---------------------------------------------------------------------- */
/* segmentation -> rough quad                                              */

function quadFromMask(mask0, w, h, minAreaFrac, log) {
  const N = w * h;
  let mask = fillHoles(mask0, w, h);
  const r = Math.max(1, Math.round(Math.min(w, h) * 0.006));
  mask = dilate(erode(mask, w, h, r), w, h, r);

  const cc = components(mask, w, h);
  if (!cc.count) return null;
  const cxh = w >> 1, cyh = h >> 1;
  let L = cc.labels[cyh * w + cxh];
  if (L < 0) {
    let bestA = -1;
    for (let l = 0; l < cc.count; l++) {
      const hits = cc.bx0[l] <= cxh && cc.bx1[l] >= cxh && cc.by0[l] <= cyh && cc.by1[l] >= cyh;
      if (hits && cc.area[l] > bestA) { bestA = cc.area[l]; L = l; }
    }
  }
  if (L < 0) { log('no component under centre'); return null; }
  const area = cc.area[L];
  if (area < minAreaFrac * N) { log('area', (area / N).toFixed(3), '< minAreaFrac'); return null; }

  // a "page" that owns most of the frame border is the background
  let bt = 0;
  for (let x = 0; x < w; x++) { if (cc.labels[x] === L) bt++; if (cc.labels[(h - 1) * w + x] === L) bt++; }
  for (let y = 0; y < h; y++) { if (cc.labels[y * w] === L) bt++; if (cc.labels[y * w + w - 1] === L) bt++; }
  if (bt > 0.6 * (2 * w + 2 * h)) { log('component owns the frame border'); return null; }

  // boundary extremes per row / column (rotation independent)
  const minX = new Int32Array(h).fill(1e9), maxX = new Int32Array(h).fill(-1);
  const minY = new Int32Array(w).fill(1e9), maxY = new Int32Array(w).fill(-1);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    if (cc.labels[i] !== L) continue;
    if (x < minX[y]) minX[y] = x; if (x > maxX[y]) maxX[y] = x;
    if (y < minY[x]) minY[x] = y; if (y > maxY[x]) maxY[x] = y;
  }
  const bnd = [];
  for (let y = 0; y < h; y++) if (maxX[y] >= 0) { bnd.push({ x: minX[y], y }); bnd.push({ x: maxX[y], y }); }
  for (let x = 0; x < w; x++) if (maxY[x] >= 0) { bnd.push({ x, y: minY[x] }); bnd.push({ x, y: maxY[x] }); }

  const hull = convexHull(bnd);
  if (hull.length < 4) return null;
  const hullA = polyArea(hull);
  if (hullA <= 0) return null;
  const conv = area / hullA;                 // notches (fingers, clips) lower this
  if (conv < 0.75) { log('convexity', conv.toFixed(3)); return null; }

  let poly = simplifyClosed(hull, 1.5), eps = 1.5;
  while (poly.length > 28) { eps *= 1.5; poly = simplifyClosed(hull, eps); }
  const q0 = maxAreaQuad(poly);
  if (!q0) return null;
  const fill = polyArea(q0) / hullA;         // how quadrilateral the hull is
  if (fill < 0.8) { log('quad fill', fill.toFixed(3)); return null; }

  const quad = fitEdges(bnd, orderCorners(q0), Math.max(2, 0.01 * Math.hypot(w, h)));
  if (!validQuad(quad, 0.04 * Math.hypot(w, h))) { log('implausible quad shape'); return null; }
  return { quad, score: conv * fill, area };
}

// replace each rough edge by a total-least-squares fit through the boundary
// points lying near it (away from the corners), then intersect
function fitEdges(bnd, quad, tol) {
  const lines = quad.map((A, i) => {
    const B = quad[(i + 1) % 4];
    const L = lineThrough(A, B);
    if (!L) return null;
    const dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy;
    const sel = [];
    for (const p of bnd) {
      if (Math.abs(L.a * p.x + L.b * p.y + L.c) > tol) continue;
      const t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / len2;
      if (t >= 0.08 && t <= 0.92) sel.push(p);
    }
    return sel.length >= 10 ? tlsLine(sel) : L;
  });
  return cornersFromLines(lines, quad, 1e9);
}

// indices of the window pixels belonging to the paper: the luma mode of the
// window (smoothed over +-12 so a lighting gradient still counts as one
// mode); when several modes are comparable the brightest wins, because print
// and photos are darker than the paper they sit on
function paperPixels(Y, w, [x0, x1, y0, y1]) {
  const hist = new Int32Array(256), sm = new Float64Array(256);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hist[Y[y * w + x]]++;
  let best = 0;
  for (let v = 0; v < 256; v++) {
    let c = 0;
    for (let k = Math.max(0, v - 12); k <= Math.min(255, v + 12); k++) c += hist[k];
    sm[v] = c; if (c > best) best = c;
  }
  let mode = 0;
  for (let v = 0; v < 256; v++) {
    const peak = sm[v] >= 0.5 * best && (v === 0 || sm[v] >= sm[v - 1]) && (v === 255 || sm[v] > sm[v + 1]);
    if (peak) mode = v;                                  // last (brightest) qualifying peak
  }
  const idx = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x;
    if (Math.abs(Y[i] - mode) <= 14) idx.push(i);
  }
  return idx;
}

function medianOf(arr, idx) {
  const hist = new Int32Array(256);
  for (const i of idx) hist[arr[i]]++;
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc * 2 >= idx.length) return v; }
  return 255;
}

// robust noise estimate: 1.4826 x median |horizontal neighbour difference|
// over pairs of paper pixels
function diffNoise(Y, idx) {
  const hist = new Int32Array(256); let n = 0;
  const set = new Set(idx);
  for (const i of idx) if (set.has(i + 1)) { hist[Math.abs(Y[i + 1] - Y[i])]++; n++; }
  if (!n) return 2;
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc * 2 >= n) return 1.4826 * (v + 0.5); }
  return 255;
}

// per-pixel gradient magnitude (central differences), max over Y/Cb/Cr
function gradMag(Y, Cb, Cr, w, h) {
  const G = new Float32Array(w * h);
  const mag = (A, i, xl, xr, yu, yd) => {
    const gx = (A[i + xr] - A[i - xl]) / 2, gy = (A[i + yd] - A[i - yu]) / 2;
    return Math.sqrt(gx * gx + gy * gy);
  };
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const xl = x > 0 ? 1 : 0, xr = x < w - 1 ? 1 : 0, yu = y > 0 ? w : 0, yd = y < h - 1 ? w : 0;
    G[i] = Math.max(mag(Y, i, xl, xr, yu, yd), mag(Cb, i, xl, xr, yu, yd), mag(Cr, i, xl, xr, yu, yd));
  }
  return G;
}

// flood fill from paper-like seeds in the central window over pixels whose
// gradient magnitude is at most t
function growFromCentre(G, D, w, h, [x0, x1, y0, y1], t) {
  const N = w * h, mask = new Uint8Array(N), stack = new Int32Array(N);
  let sp = 0;
  const tSeed = 2 + Math.max(3, t);
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = y * w + x;
    if (D[i] <= tSeed && G[i] <= t && !mask[i]) { mask[i] = 1; stack[sp++] = i; }
  }
  const tryJoin = j => { if (!mask[j] && G[j] <= t) { mask[j] = 1; stack[sp++] = j; } };
  while (sp) {
    const i = stack[--sp], x = i % w;
    if (x > 0) tryJoin(i - 1); if (x < w - 1) tryJoin(i + 1);
    if (i >= w) tryJoin(i - w); if (i < N - w) tryJoin(i + w);
  }
  return mask;
}

// image evidence for each edge, sampled along its inner 80%. At each sample
// the evidence is the larger of: the signed paper-distance increase from d px
// inside to d px outside; 0.8 x the colour difference between those two
// points (keeps edges alive under a lighting gradient, where the far side of
// the page can be further from the reference than the desk is); and the
// strongest colour gradient within +-d px (a thin crease or shadow line is all
// that separates two stacked white sheets). The per-edge statistic is the
// 60th percentile, so an edge still counts when up to 40% of it is hidden by
// a same-coloured object.
function edgeContrast(Y, Cb, Cr, D, w, h, quad, d) {
  let inFrame = 0, strong = 0, sum = 0;
  const steps = [], edge = [null, null, null, null];
  const at = (x, y) => (Math.round(y) * w + Math.round(x));
  const inside = (x, y) => x >= 1 && y >= 1 && x < w - 1 && y < h - 1;
  for (let i = 0; i < 4; i++) {
    const A = quad[i], B = quad[(i + 1) % 4];
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    const nx = dy / len, ny = -dx / len;                 // outward (clockwise, y down)
    const ev = [], K = 40;
    for (let k = 0; k < K; k++) {
      const t = 0.1 + 0.8 * (k + 0.5) / K;
      const cx = A.x + dx * t, cy = A.y + dy * t;
      if (!inside(cx + nx * (d + 1), cy + ny * (d + 1)) || !inside(cx - nx * (d + 1), cy - ny * (d + 1))) continue;
      const o = at(cx + nx * d, cy + ny * d), n = at(cx - nx * d, cy - ny * d);
      let e = Math.max(D[o] - D[n], 0.8 * colourStep(Y[o] - Y[n], Cb[o] - Cb[n], Cr[o] - Cr[n]));
      for (let s = -d; s <= d; s++) {                    // thin-line evidence
        const a = at(cx + nx * (s - 1), cy + ny * (s - 1)), b = at(cx + nx * (s + 1), cy + ny * (s + 1));
        e = Math.max(e, 0.8 * colourStep(Y[b] - Y[a], Cb[b] - Cb[a], Cr[b] - Cr[a]));
      }
      ev.push(e);
    }
    if (ev.length < K / 2) continue;                     // edge is (mostly) outside the frame
    ev.sort((a, b) => a - b);
    const q60 = ev[Math.min(ev.length - 1, Math.floor(ev.length * 0.6))];
    inFrame++; sum += q60; steps.push(q60); edge[i] = q60; if (q60 >= 6) strong++;
  }
  return { inFrame, strong, steps, edge, meanStep: inFrame ? sum / inFrame : 0 };
}

function cornersFromLines(lines, fallback, maxMove) {
  return fallback.map((q, i) => {
    const a = lines[(i + 3) % 4], b = lines[i];
    const c = a && b ? intersect(a, b) : null;
    return c && Math.hypot(c.x - q.x, c.y - q.y) <= maxMove ? c : q;
  });
}

/* ---------------------------------------------------------------------- */
/* high-resolution edge refinement                                         */

function refineEdges(px, W, H, q, ref, R, minG, weakEdge, log) {
  const sampler = makeSampler(px, W, H, ref);
  const lines = [], recovered = [false, false, false, false];
  let seed = 12345;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const mid = i => ({ x: (q[i].x + q[(i + 1) % 4].x) / 2, y: (q[i].y + q[(i + 1) % 4].y) / 2 });
  for (let i = 0; i < 4; i++) {
    const A = q[i], B = q[(i + 1) % 4];
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    let L = lineThrough(A, B);
    if (!L) { lines.push(null); continue; }
    const ux = dx / len, uy = dy / len, nx = uy, ny = -ux;   // outward normal (clockwise quad, y down)
    const K = Math.min(96, Math.max(24, Math.round(len / 6)));
    const pts = [];
    let valid = 0;
    for (let k = 0; k < K; k++) {
      const t = 0.08 + 0.84 * (k + 0.5) / K;
      const cx = A.x + ux * t * len, cy = A.y + uy * t * len;
      const g = sampler.strengths(cx, cy, nx, ny, -R, R);
      let best = -1, bg = minG, any = false;
      for (let s = 1; s < g.length - 1; s++) if (g[s] === g[s]) { any = true; if (g[s] > bg) { bg = g[s]; best = s; } }
      if (any) valid++;
      if (best < 0) continue;
      let off = 0;
      const g0 = g[best - 1], g2 = g[best + 1], den = g0 - 2 * bg + g2;
      if (den < 0 && g0 === g0 && g2 === g2) off = Math.max(-1, Math.min(1, 0.5 * (g0 - g2) / den));
      const s = best - R + off;
      pts.push({ x: cx + nx * s, y: cy + ny * s });
    }
    let used = 0;
    if (pts.length >= 8) {
      const rs = ransacLine(pts, 1.5, 80, rnd);
      if (rs && rs.inliers.length >= 0.4 * pts.length) { L = tlsLine(rs.inliers); used = rs.inliers.length; }
    }
    log('edge', i, 'samples', K, 'in frame', valid, 'edge points', pts.length, 'inliers used', used);

    // A weak edge (no image evidence at the rough position, or edge points on
    // well under half of the in-frame samples) usually means the segmentation
    // merged the page with something paper-coloured next to it: a reflection,
    // a second sheet, a white wall. Sweep inward for the outermost straight
    // line most samples agree on, and accept it only if nothing but blank
    // surface lies between it and the rough edge (print in between means the
    // line is a table rule inside the page, not the page edge).
    // Also when the line fit failed (used === 0): the rough edge is then
    // typically rotated against the true edge, so only part of it lies within
    // the +-R window and the edge points do not agree on a line.
    if (valid >= 0.3 * K && ((weakEdge && weakEdge[i]) || pts.length < 0.5 * valid || used === 0)) {
      const m = mid(i), o = mid((i + 2) % 4);
      const depth = Math.abs((o.x - m.x) * nx + (o.y - m.y) * ny);
      const range = Math.round(Math.min(0.35 * depth, 0.3 * Math.max(W, H)));
      const rec = recoverEdge(sampler, A, B, ux, uy, nx, ny, len, K, R, range, Math.max(6, minG));
      // The recovered line must separate paper (inside) from non-paper
      // (outside), and where it lies inward of the rough edge the strip in
      // between must not be paper either: if it is, the page simply continues
      // (out of frame, or a table rule inside a page that fills the frame).
      const ok = rec && Math.abs(rec.offset) > 2 && rec.outsideD >= 1.5 * rec.insideD + 3 &&
        (rec.stripD !== rec.stripD || rec.stripD >= 1.4 * rec.insideD + 3);
      log('edge', i, used === 0 ? 'fit failed;' : 'weak;', 'sweep', range + 'px ->', rec ? `offset ${rec.offset.toFixed(1)} support ${(rec.support * 100).toFixed(0)}% D inside ${rec.insideD.toFixed(1)} outside ${rec.outsideD.toFixed(1)} strip ${rec.stripD.toFixed(1)}` : 'nothing consistent', ok ? 'ACCEPTED' : 'kept');
      if (ok) { L = rec.line; recovered[i] = true; }
    }
    lines.push(L);
  }
  return q.map((c, i) => {
    const a = lines[(i + 3) % 4], b = lines[i];
    const x = a && b ? intersect(a, b) : null;
    const maxMove = (recovered[(i + 3) % 4] || recovered[i]) ? 0.4 * Math.hypot(W, H) : 4 * R;
    return x && Math.hypot(x.x - c.x, x.y - c.y) <= maxMove ? x : c;
  });
}

// bilinear colour sampler + edge-strength profiles at (near) full resolution
function makeSampler(px, W, H, ref) {
  const v = new Float32Array(4);
  const sample = (x, y) => {                            // -> v = [Y, Cb, Cr, D]
    x -= 0.5; y -= 0.5;                                   // pixel centres sit at +0.5
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    const i00 = (y0 * W + x0) * 4, i01 = i00 + 4, i10 = i00 + W * 4, i11 = i10 + 4;
    const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
    const r = px[i00] * w00 + px[i01] * w01 + px[i10] * w10 + px[i11] * w11;
    const g = px[i00 + 1] * w00 + px[i01 + 1] * w01 + px[i10 + 1] * w10 + px[i11 + 1] * w11;
    const b = px[i00 + 2] * w00 + px[i01 + 2] * w01 + px[i10 + 2] * w10 + px[i11 + 2] * w11;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    v[0] = l; v[1] = 128 + 0.564 * (b - l); v[2] = 128 + 0.713 * (r - l);
    v[3] = paperDist(l, v[1], v[2], ref);
  };
  let cap = 0, pY, pCb, pCr, pD;
  // edge strength for integer offsets s0..s1 along the normal (nx,ny) from
  // (cx,cy): the larger of the signed paper-distance increase and 0.8 x the
  // sign-free colour change, both over 2 px. NaN outside the image.
  const strengths = (cx, cy, nx, ny, s0, s1) => {
    const M = s1 - s0 + 3;
    if (M > cap) { cap = M; pY = new Float32Array(M); pCb = new Float32Array(M); pCr = new Float32Array(M); pD = new Float32Array(M); }
    for (let s = s0 - 1, k = 0; s <= s1 + 1; s++, k++) {
      const x = cx + nx * s, y = cy + ny * s;
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2) { pY[k] = NaN; continue; }
      sample(x, y); pY[k] = v[0]; pCb[k] = v[1]; pCr[k] = v[2]; pD[k] = v[3];
    }
    const out = new Float32Array(s1 - s0 + 1);
    for (let k = 1; k <= s1 - s0 + 1; k++) {
      if (pY[k - 1] !== pY[k - 1] || pY[k + 1] !== pY[k + 1]) { out[k - 1] = NaN; continue; }
      out[k - 1] = Math.max(pD[k + 1] - pD[k - 1],
        0.8 * colourStep(pY[k + 1] - pY[k - 1], pCb[k + 1] - pCb[k - 1], pCr[k + 1] - pCr[k - 1]));
    }
    return out;
  };
  const dist = (x, y) => {                              // paper distance at (x,y), NaN outside
    if (x < 1 || y < 1 || x > W - 2 || y > H - 2) return NaN;
    sample(x, y); return v[3];
  };
  return { sample, strengths, dist };
}

// Look for the true edge inward of a weak rough edge. Every sample along the
// edge contributes all its local strength maxima over [-range, R]. Lines within
// 12 deg of the rough edge are found with a (slope, offset) Hough vote counting
// distinct samples, and the OUTERMOST line supported by at least half the
// in-frame samples wins, so print inside the page cannot be chosen ahead of
// the page edge. `stripD` / `insideD` are the median paper distances just
// outside and just inside the recovered line, for the caller's paper test.
function recoverEdge(sampler, A, B, ux, uy, nx, ny, len, K, R, range, minG) {
  const pts = [];
  const Rout = Math.max(24, 4 * R);                     // the rough edge may sit inside the true one
  let valid = 0;
  for (let k = 0; k < K; k++) {
    const t = 0.08 + 0.84 * (k + 0.5) / K;
    const cx = A.x + ux * t * len, cy = A.y + uy * t * len;
    const g = sampler.strengths(cx, cy, nx, ny, -range, Rout);
    let any = false;
    for (let j = 1; j < g.length - 1; j++) {
      if (g[j] !== g[j]) continue;
      any = true;
      if (g[j] >= minG && g[j] >= g[j - 1] && g[j] > g[j + 1])
        pts.push({ k, d: (t - 0.5) * len, s: j - range, x: cx + nx * (j - range), y: cy + ny * (j - range) });
    }
    if (any) valid++;
  }
  if (valid < 0.3 * K || pts.length < 0.5 * valid) return null;
  const need = 0.5 * valid;

  // Hough: s = c + m * d, slope bins fine enough for <= 2 px drift over the edge
  const mStep = 2 / len, half = Math.max(1, Math.round(Math.tan(12 * Math.PI / 180) / mStep));
  const nM = 2 * half + 1, nC = range + Rout + 3, c0 = -range - 1;
  const acc = new Uint16Array(nM * nC), lastK = new Int16Array(nM * nC).fill(-1);
  for (const p of pts) for (let jm = 0; jm < nM; jm++) {
    const c = Math.round(p.s - (jm - half) * mStep * p.d) - c0;
    if (c < 0 || c >= nC) continue;
    const idx = jm * nC + c;
    if (lastK[idx] !== p.k) { lastK[idx] = p.k; acc[idx]++; }
  }
  const votes = (jm, c) => (c > 0 ? acc[jm * nC + c - 1] : 0) + acc[jm * nC + c] + (c < nC - 1 ? acc[jm * nC + c + 1] : 0);
  let best = null;
  for (let c = nC - 1; c >= 0 && !best; c--)              // outermost first
    for (let jm = 0; jm < nM; jm++) {
      const v = votes(jm, c);
      if (v >= need && (!best || v > best.v)) best = { c, jm, v };
    }
  if (!best) return null;
  // the best-supported bin within 3 px of the outermost qualifying one
  for (let c = best.c - 1; c >= Math.max(0, best.c - 3); c--)
    for (let jm = 0; jm < nM; jm++) { const v = votes(jm, c); if (v > best.v) best = { c, jm, v }; }

  const m = (best.jm - half) * mStep, cOff = best.c + c0;
  const inl = new Map();                                  // one inlier per sample: smallest residual
  for (const p of pts) {
    const r = Math.abs(p.s - (cOff + m * p.d));
    if (r <= 2 && (!inl.has(p.k) || r < inl.get(p.k).r)) inl.set(p.k, { p, r });
  }
  if (inl.size < need) return null;
  const inliers = [...inl.values()].map(e => e.p);
  let sSum = 0; for (const p of inliers) sSum += p.s;
  // paper distance just inside the line (4..14 px), just outside it (4..14 px),
  // and across the strip between the line and the rough edge where the line
  // lies inward of it
  const inner = [], outer = [], strip = [];
  for (let k = 0; k < K; k++) {
    const t = 0.08 + 0.84 * (k + 0.5) / K;
    const cx = A.x + ux * t * len, cy = A.y + uy * t * len, ck = cOff + m * (t - 0.5) * len;
    for (let j = 0; j < 5; j++) {
      const q = (j + 0.5) / 5;
      const si = ck - 4 - 10 * q, so = ck + 4 + 10 * q;
      const a = sampler.dist(cx + nx * si, cy + ny * si), b = sampler.dist(cx + nx * so, cy + ny * so);
      if (a === a) inner.push(a); if (b === b) outer.push(b);
      if (ck + 4 < -2) {                                  // strip from the line up to the rough edge
        const ss = ck + 4 + (-2 - ck - 4) * q, c = sampler.dist(cx + nx * ss, cy + ny * ss);
        if (c === c) strip.push(c);
      }
    }
  }
  const med = arr => { arr.sort((x, y) => x - y); return arr.length ? arr[arr.length >> 1] : NaN; };
  return { line: tlsLine(inliers), support: inl.size / valid, offset: sSum / inliers.length,
    insideD: med(inner), outsideD: med(outer), stripD: strip.length >= 10 ? med(strip) : NaN };
}

function ransacLine(pts, tol, iters, rnd) {
  const n = pts.length;
  let best = null, bestN = 0;
  for (let it = 0; it < iters; it++) {
    const i = (rnd() * n) | 0; let j = (rnd() * n) | 0;
    if (j === i) j = (j + 1) % n;
    const L = lineThrough(pts[i], pts[j]);
    if (!L) continue;
    let c = 0;
    for (const p of pts) if (Math.abs(L.a * p.x + L.b * p.y + L.c) <= tol) c++;
    if (c > bestN) { bestN = c; best = L; }
  }
  if (!best) return null;
  return { line: best, inliers: pts.filter(p => Math.abs(best.a * p.x + best.b * p.y + best.c) <= tol) };
}

/* ---------------------------------------------------------------------- */
/* image helpers                                                           */

function readPixels(canvas, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);              // flatten alpha
  cx.drawImage(canvas, 0, 0, w, h);
  return cx.getImageData(0, 0, w, h).data;
}

function toYCbCr(px, N) {
  const Y = new Uint8Array(N), Cb = new Uint8Array(N), Cr = new Uint8Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    const r = px[j], g = px[j + 1], b = px[j + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    Y[i] = y; Cb[i] = clamp255(128 + 0.564 * (b - y)); Cr[i] = clamp255(128 + 0.713 * (r - y));
  }
  return { Y, Cb, Cr };
}

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

// colour difference metric: luma weighted down (shadows change luma far more
// than chroma), chroma weighted up (paper vs beige/wood desk is mostly chroma)
const colourStep = (dy, db, dr) => Math.sqrt(0.36 * dy * dy + 2.25 * (db * db + dr * dr));

function paperDist(y, cb, cr, ref) {
  const d = colourStep(y - ref[0], cb - ref[1], cr - ref[2]);
  return d > 255 ? 255 : d;
}

function box3(src, w, h) {
  const tmp = new Uint16Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const a = x > 0 ? x - 1 : 0, b = x < w - 1 ? x + 1 : w - 1;
      tmp[o + x] = src[o + a] + src[o + x] + src[o + b];
    }
  }
  for (let y = 0; y < h; y++) {
    const a = (y > 0 ? y - 1 : 0) * w, b = (y < h - 1 ? y + 1 : h - 1) * w, o = y * w;
    for (let x = 0; x < w; x++) out[o + x] = (tmp[a + x] + tmp[o + x] + tmp[b + x] + 4) / 9;
  }
  return out;
}

function otsu(arr) {
  const hist = new Int32Array(256), N = arr.length;
  for (let i = 0; i < N; i++) hist[arr[i]]++;
  let sum = 0; for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0, wB = 0, best = 0, thr = 0;
  for (let v = 0; v < 256; v++) {
    wB += hist[v]; if (!wB) continue;
    const wF = N - wB; if (!wF) break;
    sumB += v * hist[v];
    const mB = sumB / wB, mF = (sum - sumB) / wF, vb = wB * wF * (mB - mF) * (mB - mF);
    if (vb > best) { best = vb; thr = v; }
  }
  return thr;
}

function fillHoles(mask, w, h) {
  const N = w * h, seen = new Uint8Array(N), stack = new Int32Array(N);
  let sp = 0;
  const push = i => { if (!mask[i] && !seen[i]) { seen[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp], x = i % w;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w); if (i < N - w) push(i + w);
  }
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = (mask[i] || !seen[i]) ? 1 : 0;
  return out;
}

function minMax(src, w, h, r, isMin) {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let v = src[o + x];
      for (let k = Math.max(0, x - r), e = Math.min(w - 1, x + r); k <= e; k++) {
        const s = src[o + k]; if (isMin ? s < v : s > v) v = s;
      }
      tmp[o + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let v = tmp[o + x];
      for (let k = Math.max(0, y - r), e = Math.min(h - 1, y + r); k <= e; k++) {
        const s = tmp[k * w + x]; if (isMin ? s < v : s > v) v = s;
      }
      out[o + x] = v;
    }
  }
  return out;
}
const erode = (m, w, h, r) => minMax(m, w, h, r, true);
const dilate = (m, w, h, r) => minMax(m, w, h, r, false);

function components(mask, w, h) {
  const N = w * h, labels = new Int32Array(N).fill(-1), stack = new Int32Array(N);
  const area = [], bx0 = [], bx1 = [], by0 = [], by1 = [];
  let count = 0;
  for (let s = 0; s < N; s++) {
    if (!mask[s] || labels[s] >= 0) continue;
    const l = count++;
    let sp = 0, a = 0, x0 = w, x1 = -1, y0 = h, y1 = -1;
    labels[s] = l; stack[sp++] = s;
    while (sp) {
      const i = stack[--sp], x = i % w, y = (i - x) / w;
      a++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && mask[i - 1] && labels[i - 1] < 0) { labels[i - 1] = l; stack[sp++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && labels[i + 1] < 0) { labels[i + 1] = l; stack[sp++] = i + 1; }
      if (y > 0 && mask[i - w] && labels[i - w] < 0) { labels[i - w] = l; stack[sp++] = i - w; }
      if (y < h - 1 && mask[i + w] && labels[i + w] < 0) { labels[i + w] = l; stack[sp++] = i + w; }
    }
    area.push(a); bx0.push(x0); bx1.push(x1); by0.push(y0); by1.push(y1);
  }
  return { count, labels, area, bx0, bx1, by0, by1 };
}

/* ---------------------------------------------------------------------- */
/* geometry helpers                                                        */

function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

function polyArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += q.x * r.y - r.x * q.y; }
  return Math.abs(a) / 2;
}

// Douglas-Peucker on a closed polygon
function simplifyClosed(pts, eps) {
  const n = pts.length;
  if (n <= 4) return pts;
  let f = 0, fd = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(pts[i].x - pts[0].x, pts[i].y - pts[0].y); if (d > fd) { fd = d; f = i; } }
  const a = dp(pts.slice(0, f + 1), eps), b = dp(pts.slice(f).concat([pts[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}
function dp(pts, eps) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    if (e - s < 2) continue;
    const A = pts[s], B = pts[e], dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    let bi = -1, bd = eps;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((pts[i].x - A.x) * dy - (pts[i].y - A.y) * dx) / len;
      if (d > bd) { bd = d; bi = i; }
    }
    if (bi >= 0) { keep[bi] = 1; stack.push([s, bi], [bi, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// largest-area quadrilateral with vertices on a convex polygon (n <= ~30)
function maxAreaQuad(p) {
  const n = p.length;
  if (n < 4) return null;
  if (n === 4) return p.slice();
  const tri = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  let best = -1, q = null;
  for (let i = 0; i < n - 3; i++) for (let j = i + 1; j < n - 2; j++)
    for (let k = j + 1; k < n - 1; k++) {
      const t1 = tri(p[i], p[j], p[k]);
      for (let l = k + 1; l < n; l++) {
        const a = t1 + tri(p[i], p[k], p[l]);
        if (a > best) { best = a; q = [p[i], p[j], p[k], p[l]]; }
      }
    }
  return q;
}

// clockwise (y down) starting at the top-left corner
function orderCorners(q) {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  const s = q.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let k = 0, best = Infinity;
  for (let i = 0; i < 4; i++) if (s[i].x + s[i].y < best) { best = s[i].x + s[i].y; k = i; }
  return [s[k], s[(k + 1) % 4], s[(k + 2) % 4], s[(k + 3) % 4]];
}

function validQuad(q, minSep) {
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++)
    if (Math.hypot(q[i].x - q[j].x, q[i].y - q[j].y) < minSep) return false;
  let sgn = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[(i + 3) % 4], c = q[i], n = q[(i + 1) % 4];
    const ax = p.x - c.x, ay = p.y - c.y, bx = n.x - c.x, by = n.y - c.y;
    const cr = ax * by - ay * bx;
    if (cr === 0) return false;
    const s = Math.sign(cr);
    if (!sgn) sgn = s; else if (s !== sgn) return false;           // convex
    const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
    const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    if (ang < 40 || ang > 140) return false;                       // plausible perspective
  }
  return true;
}

function lineThrough(A, B) {
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const a = dy / len, b = -dx / len;
  return { a, b, c: -(a * A.x + b * A.y) };
}

// total least squares line: a x + b y + c = 0 with a^2 + b^2 = 1
function tlsLine(pts) {
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= pts.length; my /= pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);               // principal direction
  const a = -Math.sin(th), b = Math.cos(th);
  return { a, b, c: -(a * mx + b * my) };
}

function intersect(L1, L2) {
  const det = L1.a * L2.b - L2.a * L1.b;
  if (Math.abs(det) < 1e-9) return null;
  return { x: (L1.b * L2.c - L2.b * L1.c) / det, y: (L2.a * L1.c - L1.a * L2.c) / det };
}

function toResult(q, k) {
  const up = p => ({ x: p.x * k, y: p.y * k });
  return { tl: up(q[0]), tr: up(q[1]), br: up(q[2]), bl: up(q[3]) };
}
