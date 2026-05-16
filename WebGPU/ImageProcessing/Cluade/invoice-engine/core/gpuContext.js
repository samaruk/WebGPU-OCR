// core/gpuContext.js — WebGPU device initialization

export class GPUContext {
  constructor() {
    this.adapter = null;
    this.device = null;
    this.ready = false;
  }

  async init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported in this browser.');

    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!this.adapter) throw new Error('No suitable WebGPU adapter found.');

    this.device = await this.adapter.requestDevice({
      requiredFeatures: [],
      requiredLimits: {
        maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupSizeX: 256,
      },
    });

    this.device.lost.then(info => {
      console.error('WebGPU device lost:', info.message);
    });

    this.ready = true;
    return this;
  }

  /** Create a GPU buffer from a JS typed array */
  createBuffer(data, usage, label = '') {
    const buf = this.device.createBuffer({
      label,
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new data.constructor(buf.getMappedRange()).set(data);
    buf.unmap();
    return buf;
  }

  /** Create an empty GPU buffer */
  createEmptyBuffer(size, usage, label = '') {
    return this.device.createBuffer({ label, size, usage });
  }

  /** Read a buffer back to CPU (async) */
  async readBuffer(buffer, byteLength) {
    const staging = this.device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const enc = this.device.createCommandEncoder();
    enc.copyBufferToBuffer(buffer, 0, staging, 0, byteLength);
    this.device.queue.submit([enc.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const result = staging.getMappedRange().slice(0);
    staging.unmap();
    staging.destroy();
    return result;
  }

  get limits() { return this.adapter.limits; }
}
