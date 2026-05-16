// core/bufferManager.js — GPU buffer lifecycle management

export class BufferManager {
  constructor(device) {
    this.device = device;
    this._buffers = new Map();
  }

  /**
   * Create or resize a named GPU buffer.
   */
  create(name, sizeBytes, usage, label) {
    if (this._buffers.has(name)) {
      const existing = this._buffers.get(name);
      if (existing.size >= sizeBytes) return existing;
      existing.destroy();
    }
    const buffer = this.device.createBuffer({
      label: label || name,
      size: alignTo(sizeBytes, 4),
      usage,
    });
    this._buffers.set(name, buffer);
    return buffer;
  }

  get(name) {
    return this._buffers.get(name) || null;
  }

  /**
   * Write data to a buffer (Float32Array, Uint32Array, etc.)
   */
  write(name, data, offset = 0) {
    const buf = this._buffers.get(name);
    if (!buf) throw new Error(`Buffer "${name}" does not exist`);
    this.device.queue.writeBuffer(buf, offset, data);
  }

  /**
   * Read back a buffer to CPU (async, creates staging buffer)
   */
  async readback(name, byteOffset = 0, byteLength = null) {
    const src = this._buffers.get(name);
    if (!src) throw new Error(`Buffer "${name}" does not exist`);

    const size = byteLength !== null ? byteLength : src.size;
    const staging = this.device.createBuffer({
      size: alignTo(size, 4),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(src, byteOffset, staging, 0, size);
    this.device.queue.submit([encoder.finish()]);

    await staging.mapAsync(GPUMapMode.READ);
    const result = new Uint8Array(staging.getMappedRange().slice(0));
    staging.unmap();
    staging.destroy();
    return result;
  }

  /**
   * Read back buffer as Uint32Array
   */
  async readbackU32(name, elementCount = null) {
    const src = this._buffers.get(name);
    if (!src) throw new Error(`Buffer "${name}" does not exist`);
    const count = elementCount || src.size / 4;
    const raw = await this.readback(name, 0, count * 4);
    return new Uint32Array(raw.buffer);
  }

  destroy(name) {
    const buf = this._buffers.get(name);
    if (buf) {
      buf.destroy();
      this._buffers.delete(name);
    }
  }

  destroyAll() {
    for (const [, buf] of this._buffers) buf.destroy();
    this._buffers.clear();
  }
}

function alignTo(size, alignment) {
  return Math.ceil(size / alignment) * alignment;
}
