/**
 * core/memoryPool.js – scratch-buffer pool to reduce GPU allocation churn.
 */
export class MemoryPool {
  #device; #free = new Map(); #alloc = new Set();
  constructor(device) { this.#device = device; }

  acquire(byteSize, usage, label = '') {
    const key = `${usage}::${align(byteSize)}`;
    const arr = this.#free.get(key);
    if (arr?.length) { const b = arr.pop(); this.#alloc.add(b); return b; }
    const b = this.#device.createBuffer({ size: align(byteSize), usage, label: label || key });
    this.#alloc.add(b);
    return b;
  }

  release(buffer) {
    if (!this.#alloc.has(buffer)) return;
    this.#alloc.delete(buffer);
    const key = `${buffer.usage}::${buffer.size}`;
    if (!this.#free.has(key)) this.#free.set(key, []);
    this.#free.get(key).push(buffer);
  }

  destroy() {
    this.#alloc.forEach(b => b.destroy()); this.#free.forEach(a => a.forEach(b => b.destroy()));
    this.#alloc.clear(); this.#free.clear();
  }
}
function align(n) { return Math.ceil(n / 256) * 256; }
