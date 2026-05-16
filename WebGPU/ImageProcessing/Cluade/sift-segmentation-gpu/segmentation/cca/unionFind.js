/**
 * segmentation/cca/unionFind.js – path-compressed union-find.
 */
export class UnionFind {
  #parent; #rank;
  constructor(n) {
    this.#parent = new Int32Array(n).map((_, i) => i);
    this.#rank   = new Uint8Array(n);
  }
  find(x) {
    while (this.#parent[x] !== x) {
      this.#parent[x] = this.#parent[this.#parent[x]]; // path halving
      x = this.#parent[x];
    }
    return x;
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    if (this.#rank[ra] < this.#rank[rb]) this.#parent[ra] = rb;
    else if (this.#rank[ra] > this.#rank[rb]) this.#parent[rb] = ra;
    else { this.#parent[rb] = ra; this.#rank[ra]++; }
  }
  connected(a, b) { return this.find(a) === this.find(b); }
}
