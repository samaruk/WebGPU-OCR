// core/bufferManager.js – GPU buffer utilities and lifecycle helpers

export class BufferManager {
  /** @param {GPUDevice} device */
  constructor(device) {
    this.device  = device;
    this._owned  = new Set();
  }

  // ── Factory helpers ──────────────────────────────────────────────────────

  /** Create a GPU storage buffer (read-write in shaders) */
  storage(sizeBytes, label = 'storage') {
    const buf = this.device.createBuffer({
      label,
      size:  Math.max(sizeBytes, 4),   // minimum 4 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    this._owned.add(buf);
    return buf;
  }

  /** Create a uniform buffer */
  uniform(sizeBytes, label = 'uniform') {
    const buf = this.device.createBuffer({
      label,
      size:  Math.ceil(sizeBytes / 16) * 16,  // 16-byte alignment for uniforms
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._owned.add(buf);
    return buf;
  }

  /** Create a staging buffer for CPU→GPU uploads */
  upload(sizeBytes, label = 'upload') {
    const buf = this.device.createBuffer({
      label,
      size:  sizeBytes,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
    });
    this._owned.add(buf);
    return buf;
  }

  /** Create a readback buffer for GPU→CPU */
  readback(sizeBytes, label = 'readback') {
    const buf = this.device.createBuffer({
      label,
      size:  sizeBytes,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    this._owned.add(buf);
    return buf;
  }

  /** Create an indirect dispatch buffer (pre-filled) */
  indirect(x, y = 1, z = 1, label = 'indirect') {
    const buf = this.device.createBuffer({
      label,
      size:  12,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(buf, 0, new Uint32Array([x, y, z]));
    this._owned.add(buf);
    return buf;
  }

  // ── Data helpers ─────────────────────────────────────────────────────────

  /** Write typed array data into a buffer */
  write(buffer, data, offsetBytes = 0) {
    if (data instanceof ArrayBuffer) {
      this.device.queue.writeBuffer(buffer, offsetBytes, data);
    } else {
      this.device.queue.writeBuffer(buffer, offsetBytes, data.buffer, data.byteOffset, data.byteLength);
    }
  }

  /** Create a storage buffer pre-filled with data */
  storageFromData(typedArray, label = 'storage-data') {
    const buf = this.device.createBuffer({
      label,
      size:  Math.max(typedArray.byteLength, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new (typedArray.constructor)(buf.getMappedRange()).set(typedArray);
    buf.unmap();
    this._owned.add(buf);
    return buf;
  }

  /** Read back a GPU storage buffer to a CPU typed array */
  async readback32(buffer, sizeBytes, Ctor = Float32Array) {
    const rb = this.readback(sizeBytes, 'rb_tmp');
    const enc = this.device.createCommandEncoder({ label: 'readback-enc' });
    enc.copyBufferToBuffer(buffer, 0, rb, 0, sizeBytes);
    this.device.queue.submit([enc.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    await rb.mapAsync(GPUMapMode.READ);
    const result = new Ctor(rb.getMappedRange().slice(0));
    rb.unmap();
    rb.destroy();
    this._owned.delete(rb);
    return result;
  }

  // ── Bind group helpers ───────────────────────────────────────────────────

  /**
   * Build a bind group from a flat list of resources.
   * Resources can be GPUBuffer, GPUTextureView, GPUSampler.
   */
  bindGroup(layout, resources, label = 'bg') {
    return this.device.createBindGroup({
      label,
      layout,
      entries: resources.map((res, i) => {
        if (res instanceof GPUBuffer) {
          return { binding: i, resource: { buffer: res } };
        } else {
          return { binding: i, resource: res };
        }
      }),
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /** Destroy a specific buffer (and remove from tracking) */
  destroy(buf) {
    if (buf) { buf.destroy(); this._owned.delete(buf); }
  }

  /** Destroy all tracked buffers */
  destroyAll() {
    for (const buf of this._owned) {
      try { buf.destroy(); } catch (_) { /* ignore */ }
    }
    this._owned.clear();
  }
}
