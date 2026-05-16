/**
 * postprocess/polygonFit.js – Douglas-Peucker polygon approximation of component contours.
 */
export class PolygonFit {
  static fit(graph, { polygonEpsilon = 2 } = {}) {
    return graph.nodes.map(n => {
      if (!n.bbox) return { id: n.id, polygon: bboxToPolygon(n) };
      const poly = bboxToPolygon(n);
      return { id: n.id, polygon: douglasPeucker(poly, polygonEpsilon) };
    });
  }
}

function bboxToPolygon(n) {
  if (!n.bbox) return [[n.cx, n.cy]];
  const [x0, y0, x1, y1] = n.bbox;
  return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
}

function douglasPeucker(pts, eps) {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointLineDistance(pts[i], [ax, ay], [bx, by]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const l = douglasPeucker(pts.slice(0, idx + 1), eps);
    const r = douglasPeucker(pts.slice(idx), eps);
    return [...l.slice(0, -1), ...r];
  }
  return [pts[0], pts[pts.length - 1]];
}

function pointLineDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t  = ((px - ax) * dx + (py - ay) * dy) / len2;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
