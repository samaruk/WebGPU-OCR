/**
 * utils/profiler.js – lightweight wall-clock profiler.
 */
export class Profiler {
  #marks = new Map();
  #measures = new Map();

  mark(name)    { this.#marks.set(name, performance.now()); }
  measure(name) {
    const start = this.#marks.get(name);
    if (start == null) return 0;
    const dur = performance.now() - start;
    this.#measures.set(name, (this.#measures.get(name) ?? 0) + dur);
    return dur;
  }
  get(name) { return this.#measures.get(name) ?? 0; }
  totalMs() { let s = 0; for (const v of this.#measures.values()) s += v; return s; }
  reset()   { this.#marks.clear(); this.#measures.clear(); }
  report()  {
    const lines = [];
    for (const [k, v] of this.#measures) lines.push(`  ${k.padEnd(20)} ${v.toFixed(2)} ms`);
    return lines.join('
');
  }
}
