// Batched async GPU readback to avoid per-readback queue stalls
export class GPUReadback {
  constructor(device) { this.device = device; this._pending = []; }

  /** Queue a buffer for readback. Returns a promise that resolves to Float32Array. */
  queue(gpuBuf, byteSize) {
    const staging = this.device.createBuffer({ size: byteSize, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    let resolve;
    const promise = new Promise(r => resolve = r);
    this._pending.push({ gpuBuf, byteSize, staging, resolve });
    return promise;
  }

  /** Flush all pending copies in a single command encoder, then map all. */
  async flush() {
    if (!this._pending.length) return;
    const enc = this.device.createCommandEncoder({ label: "GPUReadback::flush" });
    for (const p of this._pending) {
      enc.copyBufferToBuffer(p.gpuBuf, 0, p.staging, 0, p.byteSize);
    }
    this.device.queue.submit([enc.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    await Promise.all(this._pending.map(async p => {
      await p.staging.mapAsync(GPUMapMode.READ);
      const data = new Float32Array(p.staging.getMappedRange().slice(0));
      p.staging.unmap(); p.staging.destroy();
      p.resolve(data);
    }));
    this._pending = [];
  }
}