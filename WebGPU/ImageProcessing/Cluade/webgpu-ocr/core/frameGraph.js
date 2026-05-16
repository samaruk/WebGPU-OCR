// Declarative frame/render graph — nodes are async stage fns

export class FrameGraph {
  constructor() {
    this.nodes = [];   // { id, fn, deps[] }
    this.results = {}; // id -> result
  }

  addNode(id, deps, fn) {
    this.nodes.push({ id, deps, fn });
    return this;
  }

  async execute(ctx) {
    this.results = {};
    for (const node of this.nodes) {
      const depResults = node.deps.map(d => this.results[d]);
      this.results[node.id] = await node.fn(ctx, ...depResults);
    }
    return this.results;
  }

  reset() { this.results = {}; }
}
