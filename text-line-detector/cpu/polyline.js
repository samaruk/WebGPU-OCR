/**
 * cpu/polyline.js — Skeleton polyline extraction and simplification utilities.
 *
 * WHY NECESSARY:
 *   The GPU skeleton (Zhang-Suen output) is a set of unordered foreground pixels.
 *   To draw a meaningful centre-line dashed overlay on the output image and position
 *   the line-number label, we need an ordered sequence of points tracing the axis
 *   from one end of the text line to the other.
 *
 * ALGORITHM OVERVIEW:
 *   1. Build an adjacency list from the pixel set (8-connectivity).
 *   2. Double BFS to find the two endpoints of the skeleton path (furthest pixels apart).
 *   3. BFS path reconstruction from endpoint-1 to endpoint-2.
 *   4. Smooth the path with a sliding-window average (reduces ZS thinning jaggedness).
 *   5. Simplify with Ramer-Douglas-Peucker to reduce vertex count for Canvas drawing.
 *
 * WHY THESE THREE FUNCTIONS LIVE IN ONE FILE:
 *   extractPolyline, smoothPolyline, and rdp form a single data-transformation chain
 *   (pixels → ordered path → smoothed path → simplified path). They have no GPU
 *   dependencies and share no state with the rest of the system, making this module
 *   independently testable.
 */

/**
 * extractPolyline — Find the longest path through a skeleton pixel set via double BFS.
 *
 * WHY DOUBLE BFS (not just "find endpoints by degree"):
 *   In a tree-like skeleton, leaves have degree 1. But ZS thinning sometimes produces
 *   short stubs or branch nodes with degree 3. Using degree alone picks the wrong
 *   endpoints. Double BFS is guaranteed to find the two farthest pixels in any
 *   8-connected tree:
 *     BFS from any pixel → farthest pixel (end1)
 *     BFS from end1      → farthest pixel (end2, true other end)
 *
 * WHY PRE-ALLOCATED Uint32Array FOR THE BFS QUEUE (not a JS Array):
 *   Array.push/shift is O(1) amortised but has higher constant cost than indexed
 *   Uint32Array. For skeleton sets of 500–5 000 pixels, the difference is measurable
 *   when extractPolyline is called once per component (up to 30 components per page).
 *
 * @param {Set<number>} pixSet — flat pixel indices (i = y*W + x)
 * @param {number} W
 * @param {number} H
 * @returns {{x:number,y:number}[]} ordered path from end1 to end2
 */
export function extractPolyline(pixSet, W, H) {
  // Build adjacency list (8-connected neighbours present in the set).
  const adj = new Map();
  for (const i of pixSet) {
    const x = i % W, y = (i / W) | 0, nb = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dy && !dx) continue;
      const nx = x+dx, ny = y+dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny*W+nx;
      if (pixSet.has(j)) nb.push(j);
    }
    adj.set(i, nb);
  }

  const bfsFar = (start) => {
    const dist = new Map([[start, 0]]);
    const q = new Uint32Array(pixSet.size + 8);
    let head = 0, tail = 0, far = start, farD = 0;
    q[tail++] = start;
    while (head < tail) {
      const cur = q[head++];
      for (const nx of (adj.get(cur) || [])) {
        if (!dist.has(nx)) {
          const d = dist.get(cur) + 1;
          dist.set(nx, d); q[tail++] = nx;
          if (d > farD) { farD = d; far = nx; }
        }
      }
    }
    return far;
  };

  const bfsPath = (start, target) => {
    const par = new Map([[start, null]]);
    const q = new Uint32Array(pixSet.size + 8);
    let head = 0, tail = 0;
    q[tail++] = start;
    while (head < tail) {
      const cur = q[head++];
      if (cur === target) break;
      for (const nx of (adj.get(cur) || [])) {
        if (!par.has(nx)) { par.set(nx, cur); q[tail++] = nx; }
      }
    }
    const path = []; let n = target;
    while (n !== null && n !== undefined) { path.push(n); n = par.get(n); }
    return path.reverse();
  };

  const any  = pixSet.values().next().value;
  const end1 = bfsFar(any), end2 = bfsFar(end1);
  return bfsPath(end1, end2).map(i => ({ x: i % W, y: (i / W) | 0 }));
}

/**
 * smoothPolyline — Sliding-window average over an ordered point sequence.
 *
 * WHY NECESSARY:
 *   Zhang-Suen thinning produces 1-px-wide pixel chains that follow a staircase pattern
 *   (alternating horizontal and diagonal steps). Without smoothing, the dashed centre-line
 *   overlay on the output image looks jagged and distracting. A window of 7 (default)
 *   removes single-pixel jags while preserving the overall orientation of each text line.
 *
 * @param {number} win — smoothing window size (odd number recommended)
 */
export function smoothPolyline(pts, win = 5) {
  const half = win >> 1;
  return pts.map((_, i) => {
    let sx = 0, sy = 0, c = 0;
    for (let j = Math.max(0, i-half); j <= Math.min(pts.length-1, i+half); j++) {
      sx += pts[j].x; sy += pts[j].y; c++;
    }
    return { x: sx/c, y: sy/c };
  });
}

/**
 * rdp — Ramer-Douglas-Peucker polyline simplification.
 *
 * WHY NECESSARY:
 *   A skeleton polyline for a 2000-px text line may have 1 000+ points after smoothing.
 *   Drawing 1 000 lineTo() calls in Canvas 2D per text line is wasteful; the stroke looks
 *   identical to a 10-point simplified version at display resolution. RDP removes collinear
 *   and nearly-collinear points while preserving visually significant corners.
 *
 * @param {number} eps — maximum permissible perpendicular distance (px) before splitting
 */
export function rdp(pts, eps = 1.5) {
  if (pts.length < 3) return [...pts];
  const f = pts[0], l = pts[pts.length-1];
  const dx = l.x-f.x, dy = l.y-f.y, len = Math.hypot(dx, dy);
  let mxD = 0, mxI = 1;
  for (let i = 1; i < pts.length-1; i++) {
    const d = len > 0
      ? Math.abs(dy*pts[i].x - dx*pts[i].y + l.x*f.y - l.y*f.x) / len
      : Math.hypot(pts[i].x-f.x, pts[i].y-f.y);
    if (d > mxD) { mxD = d; mxI = i; }
  }
  if (mxD > eps) {
    const left = rdp(pts.slice(0, mxI+1), eps), right = rdp(pts.slice(mxI), eps);
    return [...left.slice(0, -1), ...right];
  }
  return [f, l];
}
