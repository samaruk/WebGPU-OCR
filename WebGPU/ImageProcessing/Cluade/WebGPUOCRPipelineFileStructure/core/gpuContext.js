/**
 * gpuContext.js
 * WebGPU device initialization, adapter selection, and shared GPU resource management.
 * Provides a singleton-style context used by all pipeline stages.
 */

export class GPUContext {
  constructor() {
    this.adapter = null;
    this.device = null;
    this.queue = null;
    this.limits = null;
    this.features = null;
    this._initialized = false;
  }

  /**
   * Initialize WebGPU adapter and device.
   * @param {Object} options
   * @param {boolean} options.powerPreference - 'high-performance' | 'low-power'
   * @param {string[]} options.requiredFeatures - additional GPUFeatureNames
   * @param {Object} options.requiredLimits - override default limits
   */
  async init(options = {}) {
    if (this._initialized) return this;

    if (!navigator.gpu) {
      throw new Error('[GPUContext] WebGPU is not supported in this environment.');
    }

    const adapterOpts = {
      powerPreference: options.powerPreference ?? 'high-performance',
    };

    this.adapter = await navigator.gpu.requestAdapter(adapterOpts);
    if (!this.adapter) {
      throw new Error('[GPUContext] Failed to acquire GPUAdapter. Check browser flags.');
    }

    //const adapterInfo = await this.adapter.requestAdapterInfo();
    //console.info('[GPUContext] Adapter:', adapterInfo.vendor, adapterInfo.architecture);

    // Gather supported limits
    const supportedLimits = this.adapter.limits;

    // Build required limits — we ask for generous limits for large texture OCR work
    const requiredLimits = {
      maxTextureDimension2D: Math.min(8192, supportedLimits.maxTextureDimension2D),
      maxBufferSize: Math.min(512 * 1024 * 1024, supportedLimits.maxBufferSize),
      maxStorageBufferBindingSize: Math.min(
        256 * 1024 * 1024,
        supportedLimits.maxStorageBufferBindingSize
      ),
      maxComputeWorkgroupStorageSize: supportedLimits.maxComputeWorkgroupStorageSize,
      maxComputeInvocationsPerWorkgroup: supportedLimits.maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupSizeX: supportedLimits.maxComputeWorkgroupSizeX,
      maxComputeWorkgroupSizeY: supportedLimits.maxComputeWorkgroupSizeY,
      maxBindGroups: supportedLimits.maxBindGroups,
      maxUniformBufferBindingSize: supportedLimits.maxUniformBufferBindingSize,
      ...options.requiredLimits,
    };

    // Detect optional features
    const wantedFeatures = [
      'shader-f16',
      'bgra8unorm-storage',
      'float32-filterable',
      ...(options.requiredFeatures ?? []),
    ];
    const requiredFeatures = wantedFeatures.filter((f) => this.adapter.features.has(f));
    console.info('[GPUContext] Enabled features:', requiredFeatures);

    this.device = await this.adapter.requestDevice({
      requiredLimits,
      requiredFeatures,
    });

    this.device.addEventListener('uncapturederror', (e) => {
      console.error('[GPUContext] Uncaptured GPU error:', e.error);
    });

    this.queue = this.device.queue;
    this.limits = this.device.limits;
    this.features = this.device.features;
    this._initialized = true;

    console.info('[GPUContext] Device ready. maxBufferSize =', this.limits.maxBufferSize);
    return this;
  }

  /** Ensure the context is ready before use */
  assertReady() {
    if (!this._initialized || !this.device) {
      throw new Error('[GPUContext] Not initialized. Call init() first.');
    }
  }

  /**
   * Create a GPUBuffer with mapped write access, fill it, then unmap.
   * @param {ArrayBuffer|TypedArray} data
   * @param {GPUBufferUsageFlags} usage
   * @returns {GPUBuffer}
   */
  createBufferWithData(data, usage) {
    this.assertReady();
    const src = data instanceof ArrayBuffer ? data : data.buffer;
    const byteOffset = data.byteOffset ?? 0;
    const byteLength = data.byteLength;
    const buf = this.device.createBuffer({
      size: align(byteLength, 4),
      usage: usage | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint8Array(buf.getMappedRange()).set(new Uint8Array(src, byteOffset, byteLength));
    buf.unmap();
    return buf;
  }

  /**
   * Create an empty GPUBuffer.
   */
  createBuffer(size, usage, label = '') {
    this.assertReady();
    return this.device.createBuffer({ size: align(size, 4), usage, label });
  }

  /**
   * Upload CPU data to an existing buffer via staging.
   */
  writeBuffer(buffer, data) {
    this.assertReady();
    const src = ArrayBuffer.isView(data) ? data : new Uint8Array(data);
    this.queue.writeBuffer(buffer, 0, src);
  }

  /**
   * Download GPU buffer data to CPU.
   * @param {GPUBuffer} buffer
   * @param {number} byteLength
   * @returns {Promise<ArrayBuffer>}
   */
  async readBuffer(buffer, byteLength) {
    this.assertReady();
    const staging = this.device.createBuffer({
      size: align(byteLength, 4),
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const enc = this.device.createCommandEncoder();
    enc.copyBufferToBuffer(buffer, 0, staging, 0, byteLength);
    this.queue.submit([enc.finish()]);

    await staging.mapAsync(GPUMapMode.READ);
    const result = staging.getMappedRange(0, byteLength).slice(0);
    staging.unmap();
    staging.destroy();
    return result;
  }

  /**
   * Create a 2D texture from an ImageBitmap or canvas.
   */
  createTextureFromImage(imageBitmap, usage, format = 'rgba8unorm') {
    this.assertReady();
    const texture = this.device.createTexture({
      size: [imageBitmap.width, imageBitmap.height, 1],
      format,
      usage: usage | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture },
      [imageBitmap.width, imageBitmap.height]
    );
    return texture;
  }

  /**
   * Compile a WGSL shader module.
   * @param {string} code - WGSL source
   * @param {string} label
   */
  createShaderModule(code, label = '') {
    this.assertReady();
    return this.device.createShaderModule({ code, label });
  }

  /**
   * Create a compute pipeline from a shader module entry point.
   */
  createComputePipeline(shaderModule, entryPoint, constants = {}) {
    this.assertReady();
    return this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint, constants },
    });
  }

  /**
   * Submit a single-shot compute pass.
   * @param {GPUComputePipeline} pipeline
   * @param {GPUBindGroup} bindGroup
   * @param {[number,number,number]} dispatch - workgroup counts
   */
  dispatch(pipeline, bindGroup, dispatch) {
    this.assertReady();
    const enc = this.device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(...dispatch);
    pass.end();
    this.queue.submit([enc.finish()]);
  }

  /** Flush all pending GPU work and wait for completion */
  async sync() {
    this.assertReady();
    await this.queue.onSubmittedWorkDone();
  }

  /** Destroy the device and free all GPU resources */
  destroy() {
    if (this.device) {
      this.device.destroy();
      this.device = null;
      this._initialized = false;
    }
  }
}

/** Align value to the next multiple of `alignment` */
function align(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

// Shared singleton
export const gpuContext = new GPUContext();
