/**
 * geometry.js — Centreline simplification and oriented bounding rectangle.
 *
 * WHY THIS FILE EXISTS:
 *   The skeleton graph gives a sequence of pixel-coordinates. Turning that
 *   into an accurate, clean oriented bounding rectangle needs three steps:
 *     1. RDP:        reduce hundreds of collinear points to key shape points.
 *     2. Catmull-Rom: smooth sharp RDP corners into a curve.
 *     3. buildMinRect: project all actual ink pixels onto the PCA axis to get
 *                     the exact minimum bounding rectangle.
 *
 * EXPORTS:
 *   rdp(pts, eps)                      → simplified polyline
 *   catmullRom(pts, samplesPerSeg)     → smooth spline points
 *   textHalfH(cx, cy, binData, W, H)  → half-height of ink at column cx
 *   buildMinRect(smooth, binData, W, H, bounds, hScale) → 4-corner OBB
 *   rotatePolyBack(poly, cx, cy, deg) → un-rotate polygon after skew correction
 */

// ── Ramer-Douglas-Peucker simplification ─────────────────────────────────────
/**
 * WHY RDP:
 *   longestPath returns one point per skeleton pixel — often 200-2000 points
 *   for a long line. Most are collinear and add no information but slow down
 *   Catmull-Rom sampling and PCA. RDP recursively removes points whose
 *   perpendicular deviation from the chord is below epsilon, retaining only
 *   the points that represent real curvature (fold distortion, slight bowing).
 *
 * @param {Array<{x,y}>} pts
 * @param {number}       eps  - Max perpendicular error in pixels
 * @returns {Array<{x,y}>}
 */
export function rdp(pts, eps) {
  if (pts.length < 3) return pts;

  const ptLine = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (!dx && !dy) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };

  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptLine(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; maxI = i; }
  }

  if (maxD > eps) {
    return [
      ...rdp(pts.slice(0, maxI + 1), eps).slice(0, -1),
      ...rdp(pts.slice(maxI), eps)
    ];
  }
  return [pts[0], pts[pts.length - 1]];
}

// ── Catmull-Rom spline interpolation ─────────────────────────────────────────
/**
 * WHY CATMULL-ROM AFTER RDP:
 *   RDP keeps the geometrically significant points but connects them with
 *   straight segments — sharp corners at each control point. These corners
 *   propagate to the OBB's top and bottom edges, making them jagged at folds.
 *   Catmull-Rom interpolates a smooth curve through the same points, so the
 *   OBB axis follows the actual text line curvature smoothly.
 *
 * WHY PHANTOM ENDPOINTS:
 *   Catmull-Rom needs a control point before the first and after the last
 *   point. We mirror: p[-1] = 2*p[0] - p[1], p[n] = 2*p[n-1] - p[n-2].
 *   This ensures the curve starts and ends exactly at the first and last points.
 *
 * @param {Array<{x,y}>} pts          - RDP-simplified control points
 * @param {number}       samplesPerSeg - Interpolated points per segment
 * @param {number}       tension       - Catmull-Rom tension (0.5 = standard)
 * @returns {Array<{x,y}>}
 */
export function catmullRom(pts, samplesPerSeg = 5, tension = 0.5) {
  if (pts.length < 2) return pts;
  const n = pts.length;

  // Add phantom points at both ends
  const p = [
    { x: 2 * pts[0].x - pts[1].x,         y: 2 * pts[0].y - pts[1].y },
    ...pts,
    { x: 2 * pts[n-1].x - pts[n-2].x,     y: 2 * pts[n-1].y - pts[n-2].y }
  ];

  const out = [];
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i-1], p1 = p[i], p2 = p[i+1], p3 = p[i+2];
    for (let j = 0; j < samplesPerSeg; j++) {
      const t = j / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      const h1 = 2*t3 - 3*t2 + 1, h2 = -2*t3 + 3*t2, h3 = t3 - 2*t2 + t, h4 = t3 - t2;
      out.push({
        x: h1*p1.x + h2*p2.x + tension*(h3*(p2.x-p0.x) + h4*(p3.x-p1.x)),
        y: h1*p1.y + h2*p2.y + tension*(h3*(p2.y-p0.y) + h4*(p3.y-p1.y))
      });
    }
  }
  out.push(pts[n - 1]);
  return out;
}

// ── Vertical ink scan for local text height ───────────────────────────────────
/**
 * WHY THIS INSTEAD OF DISTANCE TRANSFORM:
 *   The JFA distance transform gives the distance to the nearest background
 *   pixel. Skeleton pixels often land in inter-character gaps where bin=0,
 *   so the DT reads 0 there. The vertical scan searches horizontally (up to
 *   SEARCH_DX columns) to find an actual text pixel at the skeleton row, then
 *   measures the continuous ink run from top to bottom — the true ink height.
 *
 * @param {number}       cx, cy   - Skeleton point (column, row)
 * @param {Float32Array} binData  - Original binary image
 * @param {number}       W, H     - Image dimensions
 * @param {number}       clampMin - Minimum return value
 * @returns {number} Half the vertical ink extent at this location
 */
export function textHalfH(cx, cy, binData, W, H, clampMin = 3) {
  const SEARCH_DX = 12, MAX_SCAN = 150;

  for (let r = 0; r <= SEARCH_DX; r++) {
    for (const s of (r === 0 ? [0] : [-1, 1])) {
      const nx = Math.max(0, Math.min(W - 1, cx + r * s));
      if (binData[cy * W + nx] < 0.5) continue; // gap — try next column
      let top = cy, bot = cy;
      for (let y = cy - 1; y >= Math.max(0, cy - MAX_SCAN); y--) {
        if (binData[y * W + nx] > 0.5) top = y; else break;
      }
      for (let y = cy + 1; y < Math.min(H, cy + MAX_SCAN); y++) {
        if (binData[y * W + nx] > 0.5) bot = y; else break;
      }
      return (bot - top + 1) / 2;
    }
  }
  return clampMin;
}

// ── Minimum Oriented Bounding Rectangle ──────────────────────────────────────
/**
 * Compute the minimum oriented bounding rectangle for one text line.
 *
 * WHY OBB INSTEAD OF AXIS-ALIGNED BOUNDING BOX:
 *   For a skewed line (even after rotation correction there may be 1-2° residual)
 *   an AABB is much larger than the text. An OBB aligned to the PCA axis of the
 *   text centreline fits tightly on all four sides.
 *
 * WHY PROJECT ACTUAL INK PIXELS:
 *   Previous approaches (height sampling + centreline extent) gave approximate
 *   bounds. Projecting every foreground pixel in the component bounds gives
 *   exact minT/maxT (line length) and minN/maxN (line height) — the OBB
 *   edges are guaranteed to touch the outermost ink pixels.
 *
 * WHY MULTI-LINE DETECTION (perpendicular profile):
 *   If the dilation radius is too large, two adjacent lines merge into one CCA
 *   blob. The OBB would then wrap both. We detect this by projecting pixels
 *   onto the normal axis and checking for gaps (two separate text bands).
 *   If bandCount > 1, the component is a paragraph → discard the OBB.
 *
 * CORNER ORDERING (TL → TR → BR → BL):
 *   The normal is forced to point toward image top (ny ≤ 0) by choosing the
 *   90°-rotation of the axis that has a more-negative y component.
 *   "+normal" = up, "-normal" = down. Start is forced left of end.
 *   Result: TL is always top-left regardless of the line's angle.
 *
 * @param {Array<{x,y}>} smooth  - Catmull-Rom centreline (for PCA axis)
 * @param {Float32Array} binData - Original binary image (for pixel projection)
 * @param {number} W, H          - Image dimensions
 * @param {{minX,maxX,minY,maxY}} bounds - CCA component bounds to scan
 * @param {number} hScale        - Height multiplier (1.0 = exact ink coverage)
 * @param {number} clampMin      - Minimum half-height in pixels
 * @returns {Array<{x,y}>|[]} Four corners [TL,TR,BR,BL] or [] if rejected
 */
export function buildMinRect(smooth, binData, W, H, bounds, hScale = 1.0, clampMin = 3) {
  if (smooth.length < 2) return [];

  // ── 1. PCA on centreline for axis direction ───────────────────────────────
  let mx = 0, my = 0;
  for (const p of smooth) { mx += p.x; my += p.y; }
  mx /= smooth.length; my /= smooth.length;

  let cxx = 0, cxy = 0, cyy = 0;
  for (const p of smooth) {
    const dx = p.x - mx, dy = p.y - my;
    cxx += dx*dx; cxy += dx*dy; cyy += dy*dy;
  }
  const trace = cxx + cyy, det = cxx*cyy - cxy*cxy;
  const lam = trace/2 + Math.sqrt(Math.max(0, trace*trace/4 - det));
  let ex, ey;
  if (Math.abs(cxy) > 1e-6) { ex = lam - cyy; ey = cxy; }
  else { ex = cxx >= cyy ? 1 : 0; ey = cxx >= cyy ? 0 : 1; }
  const el = Math.sqrt(ex*ex + ey*ey);
  ex /= el; ey /= el;

  // Canonical axis: prefer rightward; for near-vertical prefer downward
  if (ex < 0 || (Math.abs(ex) < 0.12 && ey < 0)) { ex = -ex; ey = -ey; }

  // ── 2. Normal pointing toward image top (ny ≤ 0) ─────────────────────────
  // WHY: ensures +normal = up and -normal = down consistently for all angles.
  const nxA = -ey, nyA = ex;   // rotate axis +90°
  const nxB =  ey, nyB = -ex;  // rotate axis -90°
  const nx = nyA <= nyB ? nxA : nxB;
  const ny = nyA <= nyB ? nyA : nyB;

  // ── 3. Scan every foreground pixel in the component bounds ────────────────
  const x0 = Math.max(0, bounds.minX - 2), x1 = Math.min(W-1, bounds.maxX + 2);
  const y0 = Math.max(0, bounds.minY - 2), y1 = Math.min(H-1, bounds.maxY + 2);

  let minT = Infinity, maxT = -Infinity, minN = Infinity, maxN = -Infinity;
  let pixelCount = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (binData[y*W+x] < 0.5) continue;
      const dx = x - mx, dy2 = y - my;
      const t = dx*ex + dy2*ey;
      const n = dx*nx + dy2*ny;
      if (t < minT) minT = t; if (t > maxT) maxT = t;
      if (n < minN) minN = n; if (n > maxN) maxN = n;
      pixelCount++;
    }
  }
  if (pixelCount < 4) return [];

  // ── 4. Multi-line detection via perpendicular projection profile ──────────
  // WHY: If dilation merged two adjacent lines into one CCA blob, their OBB
  // would span multiple lines. We detect this by finding multiple text bands
  // in the perpendicular histogram and discarding the OBB if bandCount > 1.
  {
    const span = maxN - minN;
    const BINS = Math.ceil(span) + 2;
    const prof = new Float32Array(BINS);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (binData[y*W+x] < 0.5) continue;
        const bi = Math.round((x - mx)*nx + (y - my)*ny - minN);
        if (bi >= 0 && bi < BINS) prof[bi]++;
      }
    }

    // Smooth with 3-bin box filter to suppress single-pixel noise
    const sm = new Float32Array(BINS);
    for (let i = 0; i < BINS; i++) {
      sm[i] = (prof[Math.max(0, i-1)] + prof[i] + prof[Math.min(BINS-1, i+1)]) / 3;
    }

    const gapMin = Math.max(4, Math.round(span * 0.08));
    const peak = sm.reduce((a, v) => Math.max(a, v), 0);
    const textThresh = peak * 0.02;

    let bandCount = 0, gapRun = 0, inBand = false;
    for (let i = 0; i < BINS; i++) {
      if (sm[i] > textThresh) {
        if (!inBand) { if (bandCount === 0 || gapRun >= gapMin) bandCount++; inBand = true; }
        gapRun = 0;
      } else {
        if (inBand) gapRun++;
        if (gapRun >= gapMin) inBand = false;
      }
    }
    if (bandCount > 1) return []; // paragraph / multi-line block → discard
  }

  // ── 5. Build the 4 corners ────────────────────────────────────────────────
  const nCenter = (minN + maxN) / 2;
  const halfN = Math.max(clampMin, (maxN - minN) / 2 * hScale);
  const tCenter = (minT + maxT) / 2;
  const halfT = (maxT - minT) / 2;

  const mkPt = (t, n) => ({
    x: mx + t*ex + n*nx,
    y: my + t*ey + n*ny
  });

  const tL = tCenter - halfT, tR = tCenter + halfT;
  const nTop = nCenter - halfN, nBot = nCenter + halfN;

  let TL = mkPt(tL, nTop), TR = mkPt(tR, nTop);
  let BR = mkPt(tR, nBot), BL = mkPt(tL, nBot);

  // ── 6. Canonical order: TL must be at top-left ───────────────────────────
  const useX = Math.abs(ex) >= 0.12;
  if ((useX && TL.x > TR.x) || (!useX && TL.y > BL.y)) {
    let t; t = TL; TL = TR; TR = t; t = BL; BL = BR; BR = t;
  }

  return [TL, TR, BR, BL];
}

// ── Inverse rotation of polygon coordinates ───────────────────────────────────
/**
 * After processing the skew-corrected image, polygon vertices are in the
 * rotated coordinate system. This function maps them back to the original
 * image coordinate system by applying the inverse (negative) rotation.
 *
 * WHY NEEDED: The final result canvas shows the original (un-rotated) image.
 * Without this step, OBBs computed in the corrected frame would be drawn at
 * wrong positions on the original image.
 *
 * @param {Array<{x,y}>} poly     - Polygon in corrected-image space
 * @param {number}       cx, cy   - Rotation centre (image centre)
 * @param {number}       angleDeg - The skew angle that was applied (degrees)
 * @returns {Array<{x,y}>}        - Polygon in original-image space
 */
export function rotatePolyBack(poly, cx, cy, angleDeg) {
  const rad = -angleDeg * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return poly.map(({ x, y }) => {
    const dx = x - cx, dy = y - cy;
    return { x: cx + dx*cos - dy*sin, y: cy + dx*sin + dy*cos };
  });
}
