// High-resolution timer utility

export class Timer {
  constructor() { this._t = {}; }
  start(k) { this._t[k] = performance.now(); }
  stop(k)  {
    const ms = performance.now() - (this._t[k] ?? performance.now());
    delete this._t[k];
    return ms;
  }
  static async measure(label, fn) {
    const t0 = performance.now();
    const r  = await fn();
    console.debug(`[Timer] ${label}: ${(performance.now()-t0).toFixed(2)}ms`);
    return r;
  }
}
