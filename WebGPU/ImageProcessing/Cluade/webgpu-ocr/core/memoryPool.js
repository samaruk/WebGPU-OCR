// GPU Buffer pool — reuse fixed-size buffers

export class MemoryPool {
  constructor(device) {
    this.device = device;
    /** @type {Map<number, GPUBuffer[]>} */
    this.free = new Map();
    this.totalAllocated = 0;
  }

  /** Acquire a buffer of at least `byteSize` bytes */
  acquire(byteSize, usage) {
    // Round up to 256-byte alignment
    const aligned = Math.ceil(byteSize / 256) * 256;
    const bucket  = this.free.get(aligned);
    if (bucket && bucket.length > 0) {
      return bucket.pop();
    }
    this.totalAllocated += aligned;
    return this.device.createBuffer({ size: aligned, usage });
  }

  /** Return a buffer to the pool */
  release(buffer, alignedSize) {
    if (!buffer) return;
    const key = alignedSize ?? buffer.size;
    if (!this.free.has(key)) this.free.set(key, []);
    this.free.get(key).push(buffer);
  }

  /** Destroy all pooled buffers */
  flush() {
    for (const bufs of this.free.values()) bufs.forEach(b => b.destroy());
    this.free.clear();
    this.totalAllocated = 0;
  }
}
