// TensorBuffer: GPUBuffer + shape + dtype metadata
export class TensorBuffer {
  constructor(device, shape, dtype = "f32", usage = null, label = "") {
    this.device   = device;
    this.shape    = shape;
    this.dtype    = dtype;
    this.label    = label;
    this.size     = shape.reduce((a,b)=>a*b,1);
    this.byteSize = this.size * (dtype === "f16" ? 2 : 4);
    const defaultUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
    this.buffer = device.createBuffer({ label, size: Math.max(4, this.byteSize), usage: usage ?? defaultUsage });
  }

  upload(data) {
    const typed = this.dtype === "f32" ? (data instanceof Float32Array ? data : new Float32Array(data))
                                       : (data instanceof Int32Array   ? data : new Int32Array(data));
    this.device.queue.writeBuffer(this.buffer, 0, typed);
    return this;
  }

  async readback() {
    const staging = this.device.createBuffer({ size: this.byteSize, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const enc = this.device.createCommandEncoder();
    enc.copyBufferToBuffer(this.buffer, 0, staging, 0, this.byteSize);
    this.device.queue.submit([enc.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(staging.getMappedRange().slice(0));
    staging.unmap(); staging.destroy();
    return out;
  }

  static zeros(device, shape, dtype = "f32", label = "") {
    const tb = new TensorBuffer(device, shape, dtype, null, label);
    const z = dtype === "f32" ? new Float32Array(tb.size) : new Int32Array(tb.size);
    device.queue.writeBuffer(tb.buffer, 0, z);
    return tb;
  }

  destroy() { this.buffer?.destroy(); }
}