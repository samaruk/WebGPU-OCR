/**
 * clustering/spatialIndex.js – simple 2-D grid spatial index for fast radius queries.
 */
export class SpatialIndex {
  #cellSize; #grid = new Map(); #w; #h;

  constructor(cellSize = 32) { this.#cellSize = cellSize; }

  build(points, imageW, imageH) {
    this.#w = imageW; this.#h = imageH;
    this.#grid.clear();
    for (const pt of points) {
      const key = this.#key(pt.x, pt.y);
      if (!this.#grid.has(key)) this.#grid.set(key, []);
      this.#grid.get(key).push(pt);
    }
  }

  /** Return all points within radius r of (x, y). */
  query(x, y, r) {
    const cs   = this.#cellSize;
    const x0   = Math.floor((x - r) / cs);
    const x1   = Math.floor((x + r) / cs);
    const y0   = Math.floor((y - r) / cs);
    const y1   = Math.floor((y + r) / cs);
    const r2   = r * r;
    const out  = [];
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const pts = this.#grid.get(`${cx}:${cy}`);
        if (!pts) continue;
        for (const pt of pts) {
          const dx = pt.x - x, dy = pt.y - y;
          if (dx * dx + dy * dy <= r2) out.push(pt);
        }
      }
    }
    return out;
  }

  #key(x, y) {
    return `${Math.floor(x / this.#cellSize)}:${Math.floor(y / this.#cellSize)}`;
  }
}
