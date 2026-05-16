/**
 * core/bufferManager.js - GPU buffer allocation utilities.
 */
export class BufferManager {
  constructor(device) { this.device = device; }

  createUniform(data) {
    const src = data instanceof ArrayBuffer ? data : data.buffer;
    const size = Math.max(16, Math.ceil(src.byteLength / 16) * 16);
    const buf = this.device.createBuffer({
      size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(buf, 0, src);
    return buf;
  }

  createStorage(byteSize, readback = false) {
    let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
    if (readback) usage |= GPUBufferUsage.MAP_READ;
    return this.device.createBuffer({ size: byteSize, usage });
  }

  async readback(srcBuffer, byteSize) {
    const staging = this.device.createBuffer({
      size: byteSize, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(srcBuffer, 0, staging, 0, byteSize);
    this.device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const copy = staging.getMappedRange().slice(0);
    staging.unmap(); staging.destroy();
    return copy;
  }
}
