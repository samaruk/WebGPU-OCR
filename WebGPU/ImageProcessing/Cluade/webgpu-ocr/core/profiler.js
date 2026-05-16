// GPU & CPU profiler

export class Profiler {
  constructor() {
    this.records = [];
    this._starts = new Map();
  }

  start(label) {
    this._starts.set(label, performance.now());
  }

  end(label) {
    const t0 = this._starts.get(label);
    if (t0 === undefined) return;
    const ms = performance.now() - t0;
    this.records.push({ label, ms });
    this._starts.delete(label);
    return ms;
  }

  summary() {
    const totals = {};
    for (const { label, ms } of this.records) {
      totals[label] = (totals[label] ?? 0) + ms;
    }
    return totals;
  }

  totalMs() {
    return this.records.reduce((s, r) => s + r.ms, 0);
  }

  reset() {
    this.records = [];
    this._starts.clear();
  }
}

export const globalProfiler = new Profiler();
