// core/profiler.js – GPU timestamp-query profiling

export class Profiler {
  /**
   * @param {import('./gpuContext.js').GPUContext} ctx
   * @param {number} maxEntries
   */
  constructor(ctx, maxEntries = 32) {
    this.ctx         = ctx;
    this.device      = ctx.device;
    this.enabled     = ctx.hasTimestamps;
    this.maxEntries  = maxEntries;
    this._labels     = [];
    this._querySet   = null;
    this._resolveBuf = null;
    this._readBuf    = null;
    this._results    = new Map();

    if (this.enabled) this._allocate();
  }

  _allocate() {
    const capacity = this.maxEntries * 2;  // start + end per entry
    this._querySet = this.device.createQuerySet({
      type:  'timestamp',
      count: capacity,
    });
    this._resolveBuf = this.device.createBuffer({
      size:  capacity * 8,   // BigUint64 = 8 bytes
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    this._readBuf = this.device.createBuffer({
      size:  capacity * 8,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }

  /** Begin a labelled measurement section. Returns query index pair. */
  begin(encoder, label) {
    if (!this.enabled) return -1;
    const idx = this._labels.length;
    if (idx >= this.maxEntries) return -1;
    this._labels.push(label);
    encoder.writeTimestamp(this._querySet, idx * 2);
    return idx;
  }

  /** End a measurement section opened with begin(). */
  end(encoder, idx) {
    if (!this.enabled || idx < 0) return;
    encoder.writeTimestamp(this._querySet, idx * 2 + 1);
  }

  /**
   * Resolve timestamps and read back results.
   * Call after submit.
   */
  async resolve(encoder) {
    if (!this.enabled || this._labels.length === 0) return;
    const count = this._labels.length * 2;
    encoder.resolveQuerySet(this._querySet, 0, count, this._resolveBuf, 0);
    encoder.copyBufferToBuffer(this._resolveBuf, 0, this._readBuf, 0, count * 8);
  }

  async read() {
    if (!this.enabled || this._labels.length === 0) return;
    await this._readBuf.mapAsync(GPUMapMode.READ);
    const timestamps = new BigInt64Array(this._readBuf.getMappedRange());
    this._results.clear();
    for (let i = 0; i < this._labels.length; i++) {
      const start = timestamps[i * 2];
      const end   = timestamps[i * 2 + 1];
      const ms    = Number(end - start) / 1e6;
      this._results.set(this._labels[i], ms);
    }
    this._readBuf.unmap();
    this._labels = [];
  }

  /** Get GPU time for a labelled section in milliseconds */
  get(label) { return this._results.get(label) ?? 0; }

  /** All recorded timings */
  all() { return Object.fromEntries(this._results); }

  /** CPU-side timing fallback when GPU timestamps are unavailable */
  static cpuTime(fn) {
    const t = performance.now();
    return fn().then(result => ({ result, ms: performance.now() - t }));
  }

  destroy() {
    this._querySet?.destroy();
    this._resolveBuf?.destroy();
    this._readBuf?.destroy();
  }
}
