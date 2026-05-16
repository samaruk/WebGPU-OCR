// ─────────────────────────────────────────────────────────────
//  src/gpu/GPUContext.js
//  Manages WebGPU adapter, device, queue lifecycle
// ─────────────────────────────────────────────────────────────

export class GPUContext {
  constructor() {
    this.adapter  = null;
    this.device   = null;
    this.queue    = null;
    this.features = new Set();
    this.limits   = null;
    this._lostCb  = null;
  }

  /** Initialize WebGPU. Throws if unavailable. */
  async init(options = {}) {
    if (!navigator.gpu) throw new Error('WebGPU not supported in this browser.');

    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: options.powerPreference ?? 'high-performance',
    });
    if (!this.adapter) throw new Error('No suitable GPU adapter found.');

    const features = [];
    if (this.adapter.features.has('timestamp-query') && options.timestamps) {
      features.push('timestamp-query');
    }

    this.device = await this.adapter.requestDevice({
      requiredFeatures: features,
      requiredLimits:   options.limits ?? {},
    });
    this.queue  = this.device.queue;
    this.limits = this.device.limits;

    this.device.lost.then(info => {
      console.error('[GPUContext] Device lost:', info.message, info.reason);
      this._lostCb?.(info);
    });

    this.device.onuncapturederror = e => console.error('[GPUContext]', e.error);

    // Record which features we actually got
    for (const f of this.device.features) this.features.add(f);

    return this;
  }

  onDeviceLost(cb) { this._lostCb = cb; }

  /** Create a GPU buffer with optional initial data. */
  createBuffer(size, usage, data = null) {
    const aligned = Math.max(4, Math.ceil(size / 4) * 4);
    const buf = this.device.createBuffer({
      size: aligned, usage,
      mappedAtCreation: data !== null,
    });
    if (data !== null) {
      const arr = data instanceof Float32Array ? data : new Float32Array(data);
      new Float32Array(buf.getMappedRange()).set(arr);
      buf.unmap();
    }
    return buf;
  }

  /** Create a uniform buffer from a plain JS array or typed array. */
  createUniform(data) {
    const arr = data instanceof Float32Array ? data : new Float32Array(data);
    const size = Math.max(16, Math.ceil(arr.byteLength / 16) * 16);
    const buf = this.device.createBuffer({
      size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(buf.getMappedRange()).set(arr);
    buf.unmap();
    return buf;
  }

  /** Create a uniform buffer from a Uint32Array. */
  createUniformU32(data) {
    const arr = data instanceof Uint32Array ? data : new Uint32Array(data);
    const size = Math.max(16, Math.ceil(arr.byteLength / 16) * 16);
    const buf = this.device.createBuffer({
      size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint32Array(buf.getMappedRange()).set(arr);
    buf.unmap();
    return buf;
  }

  /** Asynchronously read back a GPU buffer → Float32Array. */
  async readback(gpuBuf, byteSize) {
    const staging = this.device.createBuffer({
      size: byteSize, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const enc = this.device.createCommandEncoder();
    enc.copyBufferToBuffer(gpuBuf, 0, staging, 0, byteSize);
    this.queue.submit([enc.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const copy = new Float32Array(staging.getMappedRange().slice(0));
    staging.unmap();
    staging.destroy();
    return copy;
  }

  /** Readback as Uint32Array. */
  async readbackU32(gpuBuf, byteSize) {
    const staging = this.device.createBuffer({
      size: byteSize, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const enc = this.device.createCommandEncoder();
    enc.copyBufferToBuffer(gpuBuf, 0, staging, 0, byteSize);
    this.queue.submit([enc.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const copy = new Uint32Array(staging.getMappedRange().slice(0));
    staging.unmap();
    staging.destroy();
    return copy;
  }

  /** Submit a single command buffer and wait for GPU completion. */
  async submitAndWait(cmdBuf) {
    this.queue.submit([cmdBuf]);
    await this.queue.onSubmittedWorkDone();
  }

  destroy() { this.device?.destroy(); }
}
