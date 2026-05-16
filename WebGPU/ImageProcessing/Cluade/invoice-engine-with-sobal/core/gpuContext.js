// core/gpuContext.js – WebGPU device + adapter lifecycle management

export class GPUContext {
  constructor() {
    this.adapter   = null;
    this.device    = null;
    this.limits    = null;
    this.features  = null;
    this._ready    = false;
  }

  /** Initialise adapter + device. Throws if WebGPU is unavailable. */
  async init() {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
    }

    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!this.adapter) throw new Error('No suitable GPU adapter found.');

    // Request optional features we can exploit
    const optionalFeatures = [];
    if (this.adapter.features.has('timestamp-query'))  optionalFeatures.push('timestamp-query');
    if (this.adapter.features.has('shader-f16'))       optionalFeatures.push('shader-f16');
    if (this.adapter.features.has('bgra8unorm-storage'))optionalFeatures.push('bgra8unorm-storage');

    this.device = await this.adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize:               this.adapter.limits.maxBufferSize,
        maxComputeWorkgroupSizeX:    256,
        maxComputeWorkgroupSizeY:    256,
        maxComputeInvocationsPerWorkgroup: 256,
      },
      requiredFeatures: optionalFeatures,
    });

    this.limits   = this.device.limits;
    this.features = this.device.features;
    this._ready   = true;

    // Expose global error handler
    this.device.addEventListener('uncapturederror', (e) => {
      console.error('[GPUContext] Uncaptured GPU error:', e.error);
    });

    console.info('[GPUContext] Device ready →', await this.adapter.requestAdapterInfo?.()?.catch(() => ({})));
    return this;
  }

  get ready() { return this._ready; }

  /** Human-readable adapter info string */
  async adapterInfo() {
    try {
      const info = await this.adapter.requestAdapterInfo();
      return `${info.vendor ?? 'GPU'} · ${info.description ?? ''}`.trim().replace(/·\s*$/, '');
    } catch {
      return 'WebGPU Adapter';
    }
  }

  /** Whether timestamp-query feature is available */
  get hasTimestamps() {
    return this.features?.has('timestamp-query') ?? false;
  }

  /** Create a GPUCommandEncoder with an optional label */
  encoder(label = 'cmd') {
    return this.device.createCommandEncoder({ label });
  }

  /** Submit and wait for GPU idle */
  async submit(commandBuffers) {
    if (!Array.isArray(commandBuffers)) commandBuffers = [commandBuffers];
    this.device.queue.submit(commandBuffers);
    await this.device.queue.onSubmittedWorkDone();
  }

  /** Destroy device (call on unload) */
  destroy() {
    this.device?.destroy();
    this._ready = false;
  }
}
