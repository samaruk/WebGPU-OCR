/* ======================================================================
   PERSPECTIVE RECTIFICATION  ·  Pass-0 geometric correction
   Why: a mobile photo of an invoice is shot at an angle, so the page is a
   trapezoid, not a rectangle — parallel column gutters converge, text
   scale drifts across the page, and the apparent rotation differs from
   side to side. A single rotation (the deskew stage) is a *rigid*
   transform and cannot undo any of that. This stage detects the page's
   four corners and warps that quadrilateral back to a rectangle with a
   homography, removing perspective, non-uniform scale and most "local"
   skew in one step; the rotation deskew is then left with only a tiny
   residual angle to clean up.

   Detection is region-based and deliberately conservative: Otsu split ->
   largest page-class component overlapping the frame centre -> extreme-
   corner extraction. The page quad is warped ONLY when it is convex,
   dominates the frame and is genuinely keystoned — a flat, square-on
   page (or one that is merely rotated) is passed straight through so the
   stage can never make a good capture worse.

   Self-contained: Canvas2D + plain JS only, the single import is `cca`.
   ====================================================================== */
import { cca } from '../cca/cca.js';
import { convexHull } from '../hull/hull.js';

/* Otsu's method — the gray level that best splits page from background. */
function otsu(g, n) {
    const hist = new Int32Array(256);
    for (let i = 0; i < n; i++) hist[g[i]]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = -1, thr = 127;
    for (let t = 0; t < 256; t++) {
        wB += hist[t]; if (!wB) continue;
        const wF = n - wB; if (!wF) break;
        sumB += t * hist[t];
        const d = sumB / wB - (sum - sumB) / wF, v = wB * wF * d * d;
        if (v > best) { best = v; thr = t; }
    }
    return thr;
}

/* Solve an 8x8 linear system by Gaussian elimination with partial pivot. */
function solve8(A, b) {
    const n = 8;
    for (let c = 0; c < n; c++) {
        let piv = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        if (Math.abs(A[piv][c]) < 1e-9) return null;          // singular — bail
        [A[c], A[piv]] = [A[piv], A[c]];[b[c], b[piv]] = [b[piv], b[c]];
        for (let r = c + 1; r < n; r++) {
            const f = A[r][c] / A[c][c];
            for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
            b[r] -= f * b[c];
        }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) {
        let s = b[r];
        for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
        x[r] = s / A[r][r];
    }
    return x;
}

/* Homography (8 params, h8 fixed at 1) mapping the four `dst` points
   onto the four `src` points: src = H . dst  (normalised). */
function homography(dst, src) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
        const X = dst[i].x, Y = dst[i].y, x = src[i].x, y = src[i].y;
        A.push([X, Y, 1, 0, 0, 0, -X * x, -Y * x]); b.push(x);
        A.push([0, 0, 0, X, Y, 1, -X * y, -Y * y]); b.push(y);
    }
    return solve8(A, b);                                  // [h0..h7] or null
}

/* Reduce a convex polygon to its four corners. The page hull is supplied
   by the shared monotone-chain convexHull from the hull section. */
function simplifyConvex(h, tol) {
    let v = h.slice();
    for (; ;) {
        if (v.length <= 4) break;
        let mi = -1, md = 1 / 0;
        for (let i = 0; i < v.length; i++) {
            const a = v[(i - 1 + v.length) % v.length], b = v[i], c = v[(i + 1) % v.length];
            const L = Math.hypot(c.x - a.x, c.y - a.y) || 1;
            const d = Math.abs((c.x - a.x) * (a.y - b.y) - (c.y - a.y) * (a.x - b.x)) / L;
            if (d < md) { md = d; mi = i; }
        }
        if (md >= tol) break;                 // every survivor is a real corner
        v.splice(mi, 1);
    }
    return v;
}
/* The maximum-area quadrilateral inscribed in a convex polygon. For a
   page (a near-rectangle) that is exactly its four corners, found
   optimally — no greedy mislabelling — at any rotation. The polygon is
   already tiny after simplifyConvex, so the O(V^4) search is trivial. */
function maxAreaQuad(p) {
    const V = p.length;
    if (V < 4) return null;
    if (V === 4) return p.slice();
    const ar = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    let best = -1, quad = null;
    for (let i = 0; i < V; i++) for (let j = i + 1; j < V; j++)
        for (let k = j + 1; k < V; k++) for (let l = k + 1; l < V; l++) {
            const A = ar(p[i], p[j], p[k]) + ar(p[i], p[k], p[l]);
            if (A > best) { best = A; quad = [p[i], p[j], p[k], p[l]]; }
        }
    return quad;
}
/* Label four corners tl/tr/br/bl so the page comes out upright: order
   them clockwise, then take the most horizontal, rightward-pointing edge
   as the top edge. This absorbs the invoice's in-plane rotation into the
   rectification (correct for tilts up to ~45°). */
function orderCorners(q) {
    let cx = 0, cy = 0; for (const p of q) { cx += p.x; cy += p.y; } cx /= 4; cy /= 4;
    const cw = q.slice().sort((a, b) =>
        Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));   // clockwise (y-down)
    let top = 0, best = 1 / 0;
    for (let i = 0; i < 4; i++) {
        const a = cw[i], b = cw[(i + 1) % 4];
        const ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x));        // 0 = points straight right
        if (ang < best) { best = ang; top = i; }
    }
    return { tl: cw[top], tr: cw[(top + 1) % 4], br: cw[(top + 2) % 4], bl: cw[(top + 3) % 4] };
}

/* Total-least-squares line fit (PCA): centroid + unit direction. */
function fitTLS(pts) {
    const n = pts.length; let mx = 0, my = 0;
    for (const p of pts) { mx += p.x; my += p.y; } mx /= n; my /= n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of pts) { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const l1 = (sxx + syy) / 2 + Math.sqrt(Math.max(0, (sxx - syy) * (sxx - syy) / 4 + sxy * sxy));
    let vx, vy;
    if (Math.abs(sxy) > 1e-9) { vx = l1 - syy; vy = sxy; }
    else { vx = sxx >= syy ? 1 : 0; vy = sxx >= syy ? 0 : 1; }
    const vn = Math.hypot(vx, vy) || 1;
    return { mx, my, vx: vx / vn, vy: vy / vn };
}
const perpDist = (p, L) => (p.x - L.mx) * (-L.vy) + (p.y - L.my) * L.vx;
/* boundary points lying along the page edge between corners A and B —
   the dense per-row/column extremes near that chord, corner regions and
   stray points (e.g. a shadow bulge) excluded by projection + a band. */
function edgePoints(bnd, A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    if (len < 1) return [];
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const band = Math.max(6, 0.05 * len), out = [];
    for (const p of bnd) {
        const ex = p.x - A.x, ey = p.y - A.y;
        const t = (ex * ux + ey * uy) / len;
        if (t < 0.15 || t > 0.85) continue;                 // skip the corner regions
        if (Math.abs(ex * nx + ey * ny) < band) out.push(p);
    }
    return out;
}
/* robust straight-line fit of one page edge — one outlier-rejection
   round discards shadow/threshold noise that the convex hull would keep */
function robustEdgeLine(pts) {
    if (pts.length < 6) return null;
    let line = fitTLS(pts);
    let s = 0; for (const p of pts) s += perpDist(p, line) ** 2;
    const rms = Math.sqrt(s / pts.length);
    const inl = pts.filter(p => Math.abs(perpDist(p, line)) < 2.5 * rms + 0.75);
    if (inl.length >= 6) line = fitTLS(inl);
    return line;
}
/* intersection of two lines given as centroid + direction */
function intersectLines(L1, L2) {
    const den = L1.vx * L2.vy - L1.vy * L2.vx;
    if (Math.abs(den) < 1e-9) return null;
    const s = ((L2.mx - L1.mx) * L2.vy - (L2.my - L1.my) * L2.vx) / den;
    return { x: L1.mx + s * L1.vx, y: L1.my + s * L1.vy };
}
/* Smallest interior angle (radians) of an ordered convex polygon. This is
   the honest degeneracy signal for a near-rectangle quad: the dangerous
   detection is not a strong-but-clean keystone, it is three corners that
   have collapsed nearly collinear, leaving a sliver whose homography is
   ill-conditioned. Edge-length ratios miss that case (a sliver can have
   near-equal opposite edges); the pinched corner does not. */
function minInteriorAngle(poly) {
    let mn = Math.PI; const n = poly.length;
    for (let i = 0; i < n; i++) {
        const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
        const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
        const m1 = Math.hypot(v1x, v1y) || 1, m2 = Math.hypot(v2x, v2y) || 1;
        const ang = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2))));
        if (ang < mn) mn = ang;
    }
    return mn;
}
/* Refine the four rough corners to sub-pixel accuracy: fit each of the
   four page edges as a straight line through hundreds of boundary
   points, then take each corner as the intersection of its two edges.
   This is unbiased — a single extremal boundary pixel can be pulled off
   the true corner by a shadow or a fuzzy edge (which is why the result
   was inconsistent), but two fitted edges intersect at the true corner
   regardless. Falls back to the rough quad if any edge is unreliable. */
function refineCorners(bnd, quad, diag) {
    const lines = [];
    for (let k = 0; k < 4; k++) {
        const L = robustEdgeLine(edgePoints(bnd, quad[k], quad[(k + 1) % 4]));
        if (!L) return quad;
        lines.push(L);
    }
    const out = [];
    for (let k = 0; k < 4; k++) {
        const p = intersectLines(lines[(k + 3) % 4], lines[k]);
        if (!p) return quad;
        if (Math.hypot(p.x - quad[k].x, p.y - quad[k].y) > 0.08 * diag) return quad;
        out.push(p);
    }
    return out;
}

/* Detect the page's four corners in a canvas. Returns {tl,tr,br,bl} in
   full-resolution canvas coordinates, or null when no clear page is found. */
export function detectPageQuad(canvas) {
    const CW = canvas.width, CH = canvas.height;
    if (CW < 32 || CH < 32) return null;
    // quad detection is scale-tolerant — work on a downscaled copy for speed
    const sc = Math.min(1, 900 / Math.max(CW, CH));
    const w = Math.max(32, Math.round(CW * sc)), h = Math.max(32, Math.round(CH * sc)), N = w * h;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);           // flatten any alpha
    cx.drawImage(canvas, 0, 0, w, h);
    const px = cx.getImageData(0, 0, w, h).data;
    const g = new Uint8Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) g[i] = (0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]) | 0;
    const thr = otsu(g, N);

    // page class = the majority tone inside a central window — the user
    // frames the document, so the frame centre is reliably paper
    let bright = 0, dark = 0;
    for (let y = (h * 0.35) | 0; y < (h * 0.65) | 0; y++)
        for (let x = (w * 0.35) | 0; x < (w * 0.65) | 0; x++)
            (g[y * w + x] > thr ? bright++ : dark++);
    const pageBright = bright >= dark;
    const mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) mask[i] = ((g[i] > thr) === pageBright) ? 1 : 0;

    // largest page-class component that straddles the frame centre
    const cc = cca(mask, w, h, true);
    if (!cc.count) return null;
    const cxh = w >> 1, cyh = h >> 1;
    let L = -1, bestA = -1;
    for (let l = 0; l < cc.count; l++) {
        const hitsCentre = cc.bx0[l] <= cxh && cc.bx1[l] >= cxh && cc.by0[l] <= cyh && cc.by1[l] >= cyh;
        if (hitsCentre && cc.area[l] > bestA) { bestA = cc.area[l]; L = l; }
    }
    if (L < 0) for (let l = 0; l < cc.count; l++) if (cc.area[l] > bestA) { bestA = cc.area[l]; L = l; }
    if (L < 0 || bestA < N * 0.40) return null;                 // page must dominate the frame

    // page corners, rotation-independently: collect the page region's
    // boundary extremes, hull them, reduce the hull to four corners. The
    // old extremal-x±y method mislabels corners once the invoice is turned
    // more than ~25°; the convex hull is rotation-invariant.
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
    const rough = maxAreaQuad(simplifyConvex(hull, 2));
    if (!rough) return null;
    // refine each corner to the intersection of its two fitted page edges
    const quad = refineCorners(bnd, rough, Math.hypot(w, h));
    const ord = orderCorners(quad);
    // reject a degenerate quad (corners collapsed onto each other)
    const minSep = 0.04 * Math.hypot(w, h);
    const cs = [ord.tl, ord.tr, ord.br, ord.bl];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++)
        if (Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y) < minSep) return null;
    const up = p => ({ x: p.x / sc, y: p.y / sc });                  // back to full resolution
    return { tl: up(ord.tl), tr: up(ord.tr), br: up(ord.br), bl: up(ord.bl) };
}

/* Warp the detected page quad back to an upright rectangle. Returns a new
   W x H canvas, or null when no confidently-keystoned page is found — in
   which case the caller simply keeps the original image unchanged. */
export function rectifyPerspective(canvas) {
    const quad = detectPageQuad(canvas);
    if (!quad) return null;
    const { tl, tr, br, bl } = quad;
    const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const topL = len(tl, tr), botL = len(bl, br), leftL = len(tl, bl), rightL = len(tr, br);
    if (topL < 8 || botL < 8 || leftL < 8 || rightL < 8) return null;

    // convexity — the four corners, in order, must wind consistently;
    // a self-crossing "quad" means the corner labelling is unreliable
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const q = [tl, tr, br, bl]; let sign = 0;
    for (let i = 0; i < 4; i++) {
        const z = Math.sign(cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]));
        if (!z) continue;
        if (sign === 0) sign = z; else if (z !== sign) return null;
    }

    // perspective test — is there enough perspective to be worth a warp?
    // For a convex near-rectangle, unequal opposite edges and converging
    // opposite edges are the SAME signal: by the parallelogram theorem a
    // convex quad with both pairs of opposite sides equal in length IS a
    // parallelogram (opposite sides parallel), which carries only the affine
    // skew the deskew stage handles, not perspective. So this cheap, scale-
    // free length ratio is a sufficient perspective detector — a flat or
    // merely-rotated page scores ~0 and is passed straight through — and it
    // doubles as the right cost metric: it is exactly how much the warp will
    // stretch the foreshortened edge. The cap rejects an over-stretch warp
    // (one edge a sliver of its opposite ⇒ usually a mis-detection); it is
    // raised from 0.7 to 0.8 because refineCorners makes large-but-genuine
    // keystones safe.
    const keystone = Math.max(Math.abs(topL - botL) / Math.max(topL, botL),
        Math.abs(leftL - rightL) / Math.max(leftL, rightL));
    if (keystone < 0.035 || keystone > 0.8) return null;

    // degeneracy guard — the keystone ratio is blind to the actual unstable
    // case: three corners collapsed nearly collinear, a sliver quad whose
    // homography is ill-conditioned (such a sliver can still have near-equal
    // opposite edges and slip under the cap). The smallest interior angle
    // catches it directly, independent of edge lengths.
    if (minInteriorAngle([tl, tr, br, bl]) < 25 * Math.PI / 180) return null;

    const CW = canvas.width, CH = canvas.height;
    // destination = a rectangle of the page's estimated aspect, centred in
    // the W x H frame (letterboxed with white — harmless for binarization)
    const estW = (topL + botL) / 2, estH = (leftL + rightL) / 2;
    let rw = CW, rh = CW * estH / estW;
    if (rh > CH) { rh = CH; rw = CH * estW / estH; }
    rw = Math.round(rw); rh = Math.round(rh);
    if (rw < 16 || rh < 16) return null;
    const ox = Math.round((CW - rw) / 2), oy = Math.round((CH - rh) / 2);
    const dst = [{ x: ox, y: oy }, { x: ox + rw, y: oy }, { x: ox + rw, y: oy + rh }, { x: ox, y: oy + rh }];
    const H = homography(dst, [tl, tr, br, bl]);               // dst pixel -> source pixel
    if (!H) return null;

    // inverse-sample warp (bilinear): for every destination pixel, look up
    // where it came from in the source and interpolate
    const sd = canvas.getContext('2d').getImageData(0, 0, CW, CH).data;
    const out = document.createElement('canvas'); out.width = CW; out.height = CH;
    const octx = out.getContext('2d', { willReadFrequently: true });
    const oImg = octx.createImageData(CW, CH), od = oImg.data;
    for (let i = 0; i < od.length; i += 4) { od[i] = od[i + 1] = od[i + 2] = 255; od[i + 3] = 255; }
    for (let y = oy; y < oy + rh; y++) {
        for (let x = ox; x < ox + rw; x++) {
            const wgt = H[6] * x + H[7] * y + 1;
            const sx = (H[0] * x + H[1] * y + H[2]) / wgt, sy = (H[3] * x + H[4] * y + H[5]) / wgt;
            if (sx < 0 || sy < 0 || sx >= CW - 1 || sy >= CH - 1) continue;
            const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
            const i00 = (y0 * CW + x0) * 4, i10 = i00 + 4, i01 = i00 + CW * 4, i11 = i01 + 4, o = (y * CW + x) * 4;
            for (let k = 0; k < 3; k++) {
                const a = sd[i00 + k] + (sd[i10 + k] - sd[i00 + k]) * fx;
                const b = sd[i01 + k] + (sd[i11 + k] - sd[i01 + k]) * fx;
                od[o + k] = (a + (b - a) * fy) | 0;
            }
        }
    }
    octx.putImageData(oImg, 0, 0);
    return out;
}