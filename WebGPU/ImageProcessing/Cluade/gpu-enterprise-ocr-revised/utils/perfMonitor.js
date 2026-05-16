
/**
 * Per-stage GPU timestamp profiler.
 * Usage:
 *   const pm = new PerfMonitor(device, stageNames);
 *   const { encoder, resolveAll } = pm.wrapEncoder(device.createCommandEncoder());
 *   // ... record passes using encoder ...
 *   device.queue.submit([encoder.finish()]);
 *   const times = await resolveAll();  // { sobel: 0.12, adaptive: 0.45, ... }
 */
export class PerfMonitor {
  constructor(device, stageNames) {
    this.device     = device;
    this.stages     = stageNames;
    this.supported  = device.features.has('timestamp-query');
    if (!this.supported) return;

    this._querySet = device.createQuerySet({
      type: 'timestamp',
      count: stageNames.length * 2,
    });
    this._resolveBuffer = device.createBuffer({
      size:  stageNames.length * 2 * 8,   // 8 bytes per timestamp (u64)
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    this._readBuffer = device.createBuffer({
      size:  stageNames.length * 2 * 8,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    this._stageIdx = new Map(stageNames.map((n,i)=>[n,i]));
  }

  /** Return { beginPass(name, encoder), endPass(name, encoder), resolveAll() } */
  hook() {
    const self = this;
    return {
      beginPass(name, encoder) {
        if (!self.supported) return;
        const i = self._stageIdx.get(name);
        if (i == null) return;
        encoder.writeTimestamp(self._querySet, i * 2);
      },
      endPass(name, encoder) {
        if (!self.supported) return;
        const i = self._stageIdx.get(name);
        if (i == null) return;
        encoder.writeTimestamp(self._querySet, i * 2 + 1);
      },
      async resolveAll(encoder) {
        if (!self.supported) return {};
        encoder.resolveQuerySet(self._querySet, 0, self.stages.length*2, self._resolveBuffer, 0);
        encoder.copyBufferToBuffer(self._resolveBuffer, 0, self._readBuffer, 0, self.stages.length*2*8);
      },
      async readResults() {
        if (!self.supported) return {};
        await self._readBuffer.mapAsync(GPUMapMode.READ);
        const raw = new BigInt64Array(self._readBuffer.getMappedRange().slice(0));
        self._readBuffer.unmap();
        const out = {};
        self.stages.forEach((n,i) => {
          const diff = Number(raw[i*2+1] - raw[i*2]);
          out[n] = diff / 1e6;  // nanoseconds → ms
        });
        return out;
      },
    };
  }

  destroy() {
    if (!this.supported) return;
    this._querySet.destroy();
    this._resolveBuffer.destroy();
    this._readBuffer.destroy();
  }
}
