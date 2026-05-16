// Polygon / contour utilities

/** Douglas-Peucker simplification */
export function rdp(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0, idx = 0;
  const [p0, pN] = [points[0], points[points.length-1]];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], p0, pN);
    if (d > maxDist) { maxDist = d; idx = i; }
  }
  if (maxDist > epsilon) {
    const l = rdp(points.slice(0, idx+1), epsilon);
    const r = rdp(points.slice(idx), epsilon);
    return [...l.slice(0,-1), ...r];
  }
  return [p0, pN];
}

function perpDist(p, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0]-a[0], p[1]-a[1]);
  return Math.abs(dx*(a[1]-p[1]) - dy*(a[0]-p[0])) / len;
}

/** Polygon area (shoelace) */
export function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i+1) % pts.length;
    s += pts[i][0] * pts[j][1];
    s -= pts[j][0] * pts[i][1];
  }
  return Math.abs(s) / 2;
}

/** Unclip polygon by ratio (DB post-processing) */
export function unclipPolygon(pts, ratio) {
  const area = polyArea(pts);
  const peri = perimeter(pts);
  const d = area * ratio / peri;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    const nx = -(next[1] - prev[1]);
    const ny =   next[0] - prev[0];
    const nl = Math.hypot(nx, ny) || 1;
    return [p[0] + d * nx/nl, p[1] + d * ny/nl];
  });
}

function perimeter(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i+1) % pts.length;
    s += Math.hypot(pts[j][0]-pts[i][0], pts[j][1]-pts[i][1]);
  }
  return s;
}
