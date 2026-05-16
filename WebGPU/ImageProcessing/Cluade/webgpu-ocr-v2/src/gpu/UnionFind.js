// GPU-side label resolver after connected_components.wgsl passes
// Resolves equivalence chains in the label array on CPU (only final small list)
export class UnionFind {
  constructor(size) {
    this.parent = new Uint32Array(size);
    this.rank   = new Uint32Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
  }

  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]]; // path compression
      x = this.parent[x];
    }
    return x;
  }

  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else { this.parent[rb] = ra; this.rank[ra]++; }
  }

  /** Resolve all labels in a GPU-readback Uint32Array. */
  static resolve(labels, W, H) {
    const uf = new UnionFind(W * H + 1);
    // Single pass: union current pixel with left and above neighbours
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!labels[i]) continue;
        if (x > 0   && labels[i-1]) uf.union(labels[i], labels[i-1]);
        if (y > 0   && labels[i-W]) uf.union(labels[i], labels[i-W]);
      }
    }
    // Remap
    const out = new Uint32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (labels[i]) out[i] = uf.find(labels[i]);
    }
    return out;
  }
}