// GPU Tensor — wraps a GPUBuffer with shape/dtype metadata

export class Tensor {
  /**
   * @param {GPUDevice} device
   * @param {number[]} shape
   * @param {'f32'|'u32'|'i32'} dtype
   * @param {GPUBufferUsageFlags} [extraUsage]
   */
  constructor(device, shape, dtype = 'f32', extraUsage = 0) {
    this.device = device;
    this.shape  = shape;
    this.dtype  = dtype;

    const bytesPerEl = dtype === 'f32' ? 4 : dtype === 'u32' ? 4 : 4;
    this.numel = shape.reduce((a, b) => a * b, 1);
    this.byteSize = this.numel * bytesPerEl;

    this.buffer = device.createBuffer({
      size:  Math.max(this.byteSize, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | extraUsage,
    });
  }

  /** Upload typed-array data to this tensor */
  upload(data) {
    const arr = this.dtype === 'f32' ? new Float32Array(data)
              : this.dtype === 'u32' ? new Uint32Array(data)
              : new Int32Array(data);
    this.device.queue.writeBuffer(this.buffer, 0, arr);
    return this;
  }

  /** Read tensor back to CPU (returns typed array) */
  async download() {
    const staging = this.device.createBuffer({
      size:  this.byteSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const enc = this.device.createCommandEncoder();
    enc.copyBufferToBuffer(this.buffer, 0, staging, 0, this.byteSize);
    this.device.queue.submit([enc.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const copy = staging.getMappedRange().slice(0);
    staging.unmap();
    staging.destroy();
    return this.dtype === 'f32' ? new Float32Array(copy)
         : this.dtype === 'u32' ? new Uint32Array(copy)
         : new Int32Array(copy);
  }

  /** Create a zero-filled tensor */
  static zeros(device, shape, dtype = 'f32') {
    const t = new Tensor(device, shape, dtype);
    const enc = device.createCommandEncoder();
    enc.clearBuffer(t.buffer);
    device.queue.submit([enc.finish()]);
    return t;
  }

  destroy() { this.buffer.destroy(); }
}
