// DAG-based stage registry – declares inputs/outputs for auto-scheduling
export class StageRegistry {
  constructor() { this._stages = new Map(); }

  register(id, { label, inputs = [], outputs = [], execute, enabled = true }) {
    this._stages.set(id, { id, label, inputs, outputs, execute, enabled });
  }

  get(id)     { return this._stages.get(id); }
  getAll()    { return [...this._stages.values()]; }
  getEnabled(){ return [...this._stages.values()].filter(s => s.enabled); }

  /** Topological sort respecting input/output dependencies */
  topoSort() {
    const stages = this.getEnabled();
    const outputMap = new Map(); // output name → stage id
    for (const s of stages) for (const o of s.outputs) outputMap.set(o, s.id);

    const visited = new Set(), result = [];
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const s = this._stages.get(id);
      if (!s) return;
      for (const inp of s.inputs) {
        const dep = outputMap.get(inp);
        if (dep) visit(dep);
      }
      result.push(id);
    };
    stages.forEach(s => visit(s.id));
    return result;
  }
}