// GPU profiler: performance.now() + queue.onSubmittedWorkDone()
export class GPUProfiler {
  constructor(device) { this.device = device; this._records = []; }

  begin(label) { return { label, t0: performance.now() }; }

  async end(marker) {
    await this.device.queue.onSubmittedWorkDone();
    const ms = performance.now() - marker.t0;
    this._records.push({ label: marker.label, ms });
    return ms;
  }

  get records() { return [...this._records]; }
  totalMs()     { return this._records.reduce((s,r)=>s+r.ms,0); }
  clear()       { this._records = []; }

  report() {
    return this._records
      .sort((a,b)=>b.ms-a.ms)
      .map(r=>`${r.label.padEnd(32)} ${r.ms.toFixed(2)}ms`)
      .join("\n");
  }
}