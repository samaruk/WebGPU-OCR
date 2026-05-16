// core/frameGraph.js – Declarative GPU pass ordering and execution

/**
 * FrameGraph lets stages register themselves as nodes with declared
 * read/write texture handles. The graph validates dependencies and
 * calls each stage in topological order.
 */
export class FrameGraph {
  constructor() {
    this._nodes    = new Map();   // name → {fn, reads, writes, deps}
    this._order    = [];
    this._built    = false;
    this._results  = new Map();   // name → result of stage fn
  }

  /**
   * Register a stage.
   * @param {string}   name     - unique stage name
   * @param {string[]} reads    - names of resources this stage reads
   * @param {string[]} writes   - names of resources this stage produces
   * @param {Function} fn       - async (resources, results) => any
   */
  addPass(name, reads, writes, fn) {
    this._nodes.set(name, { fn, reads, writes });
    this._built = false;
    return this;
  }

  /** Build topological execution order */
  build() {
    const nodes   = this._nodes;
    const visited = new Set();
    const order   = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      if (!nodes.has(name)) return;  // external resource
      visited.add(name);

      const node = nodes.get(name);
      // For each resource this node reads, find which node writes it
      for (const res of node.reads) {
        for (const [otherName, other] of nodes) {
          if (other.writes.includes(res) && otherName !== name) {
            visit(otherName);
          }
        }
      }
      order.push(name);
    };

    for (const name of nodes.keys()) visit(name);
    this._order = order;
    this._built = true;
  }

  /**
   * Execute all passes in order.
   * @param {object}   resources  - initial resource dictionary
   * @param {Function} onProgress - (stageName, index, total) => void
   */
  async execute(resources, onProgress = null) {
    if (!this._built) this.build();
    this._results.clear();

    const ctx = { ...resources };   // copy so we can add stage outputs
    let i = 0;
    for (const name of this._order) {
      const node = this._nodes.get(name);
      onProgress?.(name, i, this._order.length);
      const t0     = performance.now();
      const result = await node.fn(ctx, this._results);
      const dt     = performance.now() - t0;
      this._results.set(name, { result, ms: dt });

      // Make outputs available to downstream stages
      if (result && typeof result === 'object') {
        Object.assign(ctx, result);
      }
      i++;
    }

    return { results: this._results, ctx };
  }

  /** Get the timing result for a specific pass (after execute) */
  timing(name) {
    return this._results.get(name)?.ms ?? 0;
  }

  /** Get the returned value from a specific pass */
  output(name) {
    return this._results.get(name)?.result;
  }

  /** Clear all registered nodes */
  clear() {
    this._nodes.clear();
    this._order = [];
    this._built = false;
    this._results.clear();
  }
}
