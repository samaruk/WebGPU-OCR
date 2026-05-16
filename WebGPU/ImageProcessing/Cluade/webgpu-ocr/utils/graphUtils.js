// Graph data structure utilities

export class Graph {
  constructor() {
    this.nodes = new Map();   // id -> { id, features, ... }
    this.edges = [];          // { src, dst, weight }
  }

  addNode(id, data) { this.nodes.set(id, { id, ...data }); return this; }
  addEdge(src, dst, weight = 1) { this.edges.push({ src, dst, weight }); return this; }

  neighbors(id) {
    return this.edges
      .filter(e => e.src === id || e.dst === id)
      .map(e => e.src === id ? e.dst : e.src);
  }

  toAdjacencyList() {
    const adj = {};
    for (const [id] of this.nodes) adj[id] = [];
    for (const { src, dst, weight } of this.edges) {
      adj[src]?.push({ id: dst, weight });
      adj[dst]?.push({ id: src, weight });
    }
    return adj;
  }

  toFlatBuffers() {
    const ids  = [...this.nodes.keys()];
    const idxOf = {};
    ids.forEach((id, i) => { idxOf[id] = i; });
    const edgeSrc = new Int32Array(this.edges.length);
    const edgeDst = new Int32Array(this.edges.length);
    const edgeW   = new Float32Array(this.edges.length);
    this.edges.forEach(({ src, dst, weight }, i) => {
      edgeSrc[i] = idxOf[src] ?? -1;
      edgeDst[i] = idxOf[dst] ?? -1;
      edgeW[i]   = weight;
    });
    return { n: ids.length, edgeSrc, edgeDst, edgeW };
  }
}
