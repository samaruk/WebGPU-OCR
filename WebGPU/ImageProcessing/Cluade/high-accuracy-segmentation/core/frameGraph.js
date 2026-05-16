/**
 * core/frameGraph.js
 * Lightweight stage dependency graph.
 * Tracks which stages depend on which outputs and validates execution order.
 */
export class FrameGraph {
  constructor() {
    this._nodes = new Map();  // stageName → { deps: string[], outputs: string[] }
    this._completed = new Set();
  }

  register(stageName, deps = [], outputs = []) {
    this._nodes.set(stageName, { deps, outputs });
  }

  canRun(stageName) {
    const node = this._nodes.get(stageName);
    if (!node) return true; // unregistered stage always runs
    return node.deps.every(d => this._completed.has(d));
  }

  markDone(stageName) {
    this._completed.add(stageName);
    const node = this._nodes.get(stageName);
    if (node) node.outputs.forEach(o => this._completed.add(o));
  }

  reset() { this._completed.clear(); }

  /** Return ordered list of all stages respecting dependencies. */
  topologicalOrder() {
    const visited = new Set();
    const order = [];
    const visit = (name) => {
      if (visited.has(name)) return;
      visited.add(name);
      const node = this._nodes.get(name);
      if (node) node.deps.forEach(visit);
      order.push(name);
    };
    for (const name of this._nodes.keys()) visit(name);
    return order;
  }
}
