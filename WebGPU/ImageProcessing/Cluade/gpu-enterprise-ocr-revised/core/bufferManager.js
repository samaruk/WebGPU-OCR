
export class BufferManager {
  constructor(device) { this.device = device; this._bufs = []; }

  create(size, usage, label = '') {
    const buf = this.device.createBuffer({ size: Math.max(size, 4), usage, label });
    this._bufs.push(buf);
    return buf;
  }

  uniform(data, label = '') {
    const arr = (data instanceof Float32Array || data instanceof Uint32Array)
                ? data : new Float32Array(data);
    const buf = this.create(arr.byteLength,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label);
    this.device.queue.writeBuffer(buf, 0, arr);
    return buf;
  }

  storage(sizeBytes, readable = false, label = '') {
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST |
                  (readable ? GPUBufferUsage.COPY_SRC : 0);
    return this.create(sizeBytes, usage, label);
  }

  /** Atomic storage (STORAGE | COPY_DST | COPY_SRC — no MAP_READ flag) */
  atomicStorage(sizeBytes, label = '') {
    return this.create(sizeBytes,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, label);
  }

  staging(sizeBytes, label = '') {
    return this.create(sizeBytes,
      GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, label);
  }

  /** Destroy all buffers and clear the list – call between pipeline runs */
  reset() { this._bufs.forEach(b => b.destroy()); this._bufs = []; }
}
