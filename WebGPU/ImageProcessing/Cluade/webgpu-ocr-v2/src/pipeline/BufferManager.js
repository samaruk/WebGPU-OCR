// Manages GPU buffer lifecycle – allocation, pooling, release
export class BufferManager {
  constructor(device) {
    this.device = device;
    this._pool  = [];
    this._live  = new Set();
    this._totalBytes = 0;
  }

  acquire(size, usage, label = "") {
    const aligned = Math.ceil(size / 256) * 256;
    const idx = this._pool.findIndex(b => b._usage === usage && b.size >= aligned && b.size <= aligned * 2);
    if (idx >= 0) {
      const buf = this._pool.splice(idx, 1)[0];
      this._live.add(buf);
      return buf;
    }
    const buf = this.device.createBuffer({ size: aligned, usage, label });
    buf._usage = usage; buf._pooled = true;
    this._live.add(buf);
    this._totalBytes += aligned;
    return buf;
  }

  release(buf) {
    if (!buf?._pooled) return;
    this._live.delete(buf);
    this._pool.push(buf);
  }

  releaseAll() {
    for (const buf of this._live) this._pool.push(buf);
    this._live.clear();
  }

  destroy() {
    [...this._pool, ...this._live].forEach(b => { try { b.destroy(); } catch {} });
    this._pool = []; this._live.clear();
  }

  get stats() { return { pooled: this._pool.length, live: this._live.size, totalMB: (this._totalBytes/1e6).toFixed(2) }; }
}