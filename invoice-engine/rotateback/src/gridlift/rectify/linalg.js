/**
 * Minimal projective geometry: 3x3 matrices, homogeneous points and lines,
 * and a symmetric-3x3 eigensolver for least-squares null spaces.
 *
 * Matrices are row-major Float64Array(9):
 *   [ m0 m1 m2
 *     m3 m4 m5
 *     m6 m7 m8 ]
 *
 * Points and lines are both [x, y, w] triples - the duality is the whole point:
 * a line through two points is their cross product, and a point on two lines is
 * likewise. Vanishing points fall straight out of that, including the ones at
 * infinity, which is why the degenerate "no perspective" case needs no special
 * casing here.
 */

export const M = {
  identity: () => Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]),

  mul(A, B) {
    const C = new Float64Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
      }
    }
    return C;
  },

  /** Apply to a homogeneous triple. */
  applyH(H, p) {
    return [
      H[0] * p[0] + H[1] * p[1] + H[2] * p[2],
      H[3] * p[0] + H[4] * p[1] + H[5] * p[2],
      H[6] * p[0] + H[7] * p[1] + H[8] * p[2],
    ];
  },

  /** Apply to a Euclidean point, returning a Euclidean point. */
  apply(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    const iw = Math.abs(w) < 1e-12 ? 0 : 1 / w;
    return [(H[0] * x + H[1] * y + H[2]) * iw, (H[3] * x + H[4] * y + H[5]) * iw];
  },

  det(A) {
    return (
      A[0] * (A[4] * A[8] - A[5] * A[7]) -
      A[1] * (A[3] * A[8] - A[5] * A[6]) +
      A[2] * (A[3] * A[7] - A[4] * A[6])
    );
  },

  inverse(A) {
    const d = M.det(A);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-18) return null;
    const i = 1 / d;
    return Float64Array.from([
      (A[4] * A[8] - A[5] * A[7]) * i,
      (A[2] * A[7] - A[1] * A[8]) * i,
      (A[1] * A[5] - A[2] * A[4]) * i,
      (A[5] * A[6] - A[3] * A[8]) * i,
      (A[0] * A[8] - A[2] * A[6]) * i,
      (A[2] * A[3] - A[0] * A[5]) * i,
      (A[3] * A[7] - A[4] * A[6]) * i,
      (A[1] * A[6] - A[0] * A[7]) * i,
      (A[0] * A[4] - A[1] * A[3]) * i,
    ]);
  },

  transpose(A) {
    return Float64Array.from([A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]]);
  },

  /** Scale so the matrix is comparable across estimates. */
  normalize(A) {
    const s = A[8];
    if (Math.abs(s) < 1e-15) return A;
    const out = new Float64Array(9);
    for (let i = 0; i < 9; i++) out[i] = A[i] / s;
    return out;
  },

  translate: (tx, ty) => Float64Array.from([1, 0, tx, 0, 1, ty, 0, 0, 1]),
  scale: (sx, sy = sx) => Float64Array.from([sx, 0, 0, 0, sy, 0, 0, 0, 1]),
  rotate: (rad) => {
    const c = Math.cos(rad), s = Math.sin(rad);
    return Float64Array.from([c, -s, 0, s, c, 0, 0, 0, 1]);
  },
};

/* ------------------------------------------------------------------ *
 * Homogeneous 3-vectors
 * ------------------------------------------------------------------ */

export const V = {
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: (a) => Math.hypot(a[0], a[1], a[2]),
  unit(a) {
    const n = V.norm(a);
    return n < 1e-15 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
  },
  /** Normalise a *line* so its (a,b) part is a unit normal. */
  unitLine(l) {
    const n = Math.hypot(l[0], l[1]);
    return n < 1e-15 ? [0, 0, 0] : [l[0] / n, l[1] / n, l[2] / n];
  },
  /** Euclidean position, or null when the point is at (or near) infinity. */
  euclid(p, eps = 1e-9) {
    if (Math.abs(p[2]) < eps * Math.hypot(p[0], p[1])) return null;
    return [p[0] / p[2], p[1] / p[2]];
  },
};

/* ------------------------------------------------------------------ *
 * Symmetric eigen-decomposition (cyclic Jacobi)
 * ------------------------------------------------------------------ */

/**
 * Eigenvectors of a symmetric 3x3, returned smallest-eigenvalue-first.
 *
 * Used to solve `find V minimising sum (l_i . V)^2` - the least-squares
 * vanishing point over a set of lines, which is the null space of
 * `sum l_i l_i^T`. Jacobi rather than a closed form because the matrix is
 * near-singular by construction and the closed form loses precision exactly
 * there.
 */
export function symmetricEigen(A, sweeps = 24) {
  const a = Float64Array.from(A);
  let Vm = M.identity();

  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) off += a[p * 3 + q] ** 2;
    if (off < 1e-24) break;

    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p * 3 + q];
      if (Math.abs(apq) < 1e-30) continue;
      const app = a[p * 3 + p];
      const aqq = a[q * 3 + q];
      const theta = (aqq - app) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;

      for (let k = 0; k < 3; k++) {
        const akp = a[k * 3 + p];
        const akq = a[k * 3 + q];
        a[k * 3 + p] = c * akp - s * akq;
        a[k * 3 + q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p * 3 + k];
        const aqk = a[q * 3 + k];
        a[p * 3 + k] = c * apk - s * aqk;
        a[q * 3 + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = Vm[k * 3 + p];
        const vkq = Vm[k * 3 + q];
        Vm[k * 3 + p] = c * vkp - s * vkq;
        Vm[k * 3 + q] = s * vkp + c * vkq;
      }
    }
  }

  const pairs = [0, 1, 2]
    .map((i) => ({ value: a[i * 3 + i], vector: [Vm[i], Vm[3 + i], Vm[6 + i]] }))
    .sort((x, y) => x.value - y.value);
  return pairs;
}

/** Least-squares intersection of many lines (their common point). */
export function nullSpacePoint(lines) {
  const S = new Float64Array(9);
  for (const l of lines) {
    const u = V.unitLine(l);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r * 3 + c] += u[r] * u[c];
  }
  return symmetricEigen(S)[0].vector;
}

/* ------------------------------------------------------------------ *
 * Conditioning
 * ------------------------------------------------------------------ */

/**
 * Hartley normalisation. Estimating a homography in raw pixel coordinates on a
 * 3000px page means entries spanning six orders of magnitude and a hopelessly
 * conditioned system; centring at the image middle and scaling by the
 * half-diagonal fixes that, and the result is un-normalised at the end.
 */
export function normaliser(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const s = 2 / Math.hypot(width, height);
  const T = Float64Array.from([s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1]);
  const Tinv = Float64Array.from([1 / s, 0, cx, 0, 1 / s, cy, 0, 0, 1]);
  return { T, Tinv, cx, cy, scale: s };
}

/** Total least squares line fit through points; returns a homogeneous line. */
export function fitLine(points) {
  const n = points.length;
  if (n < 2) return null;
  let mx = 0, my = 0;
  for (const p of points) { mx += p[0]; my += p[1]; }
  mx /= n; my /= n;

  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    const dx = p[0] - mx, dy = p[1] - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  // Principal direction = eigenvector of the larger eigenvalue of [[sxx,sxy],[sxy,syy]].
  const t = sxx + syy;
  const d = sxx * syy - sxy * sxy;
  const disc = Math.max(0, (t * t) / 4 - d);
  const lambda = t / 2 + Math.sqrt(disc);
  let dirX = sxy;
  let dirY = lambda - sxx;
  if (Math.hypot(dirX, dirY) < 1e-12) { dirX = lambda - syy; dirY = sxy; }
  if (Math.hypot(dirX, dirY) < 1e-12) { dirX = 1; dirY = 0; }
  const dn = Math.hypot(dirX, dirY);
  dirX /= dn; dirY /= dn;
  // A fitted line has no inherent direction; pick one canonically or the angle
  // of a horizontal line comes back as 0 or 180 at random and every spread
  // statistic computed from it is meaningless.
  if (dirX < 0 || (dirX === 0 && dirY < 0)) { dirX = -dirX; dirY = -dirY; }

  // Line normal is perpendicular to the direction.
  const a = -dirY, b = dirX;
  return {
    line: [a, b, -(a * mx + b * my)],
    mid: [mx, my],
    dir: [dirX, dirY],
    /** RMS perpendicular residual - how straight the points really are. */
    rms: Math.sqrt(
      points.reduce((s2, p) => s2 + (a * (p[0] - mx) + b * (p[1] - my)) ** 2, 0) / n,
    ),
    count: n,
    span: Math.hypot(
      Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1])),
    ),
  };
}
