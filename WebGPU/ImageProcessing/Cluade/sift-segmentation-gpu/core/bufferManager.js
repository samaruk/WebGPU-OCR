/**
 * core/bufferManager.js – GPU buffer lifecycle management.
 */
export class BufferManager {
  #device; #tracked = new Set();
  constructor(device) { this.#device = device; }

  create(byteSize, usage, label = '', initData = null) {
    const size   = align(byteSize);
    const buffer = this.#device.createBuffer({ size, usage, label, mappedAtCreation: !!initData });
    if (initData) { new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(initData)); buffer.unmap(); }
    this.#tracked.add(buffer);
    return buffer;
  }

  storage(bytes, label = '', init = null) {
    return this.create(bytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, label, init);
  }
  uniform(bytes, label = '', init = null) {
    return this.create(bytes, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label, init);
  }
  staging(bytes, label = '') {
    return this.create(bytes, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, label);
  }

  write(buffer, data, offset = 0) {
    this.#device.queue.writeBuffer(buffer, offset, data instanceof ArrayBuffer ? data : data.buffer, data.byteOffset ?? 0, data.byteLength);
  }

  async read(src, bytes, srcOffset = 0) {
    const st = this.staging(bytes);
    const enc = this.#device.createCommandEncoder();
    enc.copyBufferToBuffer(src, srcOffset, st, 0, bytes);
    this.#device.queue.submit([enc.finish()]);
    await st.mapAsync(GPUMapMode.READ);
    const copy = st.getMappedRange().slice(0);
    st.unmap(); st.destroy();
    return copy;
  }

  free(b) { b.destroy(); this.#tracked.delete(b); }
  destroy() { this.#tracked.forEach(b => b.destroy()); this.#tracked.clear(); }
}
function align(n) { return Math.ceil(n / 256) * 256; }
