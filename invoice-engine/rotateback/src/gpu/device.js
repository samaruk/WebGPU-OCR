/**
 * GPU device acquisition + capability probing.
 *
 * GRIDLIFT keeps every intermediate representation resident on the GPU, so the
 * only thing that matters at init time is: how big a storage buffer may we bind,
 * and how big may a single buffer be. Those two limits decide the maximum
 * working resolution the pipeline can normalise an invoice down to.
 */

export const DEFAULT_LIMITS = {
  maxStorageBufferBindingSize: 512 * 1024 * 1024,
  maxBufferSize: 512 * 1024 * 1024,
  maxComputeWorkgroupStorageSize: 16384,
};

export class GpuContext {
  constructor(adapter, device) {
    this.adapter = adapter;
    this.device = device;
    this.limits = device.limits;
    this._pipelines = new Map();
    this._layouts = new Map();
    this.timing = adapter.features.has('timestamp-query') && device.features.has('timestamp-query');
  }

  /**
   * @param {{ powerPreference?: GPUPowerPreference, timestamps?: boolean }} opts
   */
  static async create(opts = {}) {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      throw new Error('WebGPU unavailable: navigator.gpu is undefined. Use Chrome 113+/Edge 113+ over https or localhost.');
    }
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: opts.powerPreference ?? 'high-performance',
    });
    if (!adapter) throw new Error('WebGPU: no adapter (GPU blocklisted or unavailable).');

    // Ask for as much as the adapter allows, never more.
    const requiredLimits = {};
    for (const [k, wanted] of Object.entries(DEFAULT_LIMITS)) {
      const max = adapter.limits[k];
      if (typeof max === 'number') requiredLimits[k] = Math.min(wanted, max);
    }
    const requiredFeatures = [];
    if (opts.timestamps !== false && adapter.features.has('timestamp-query')) {
      requiredFeatures.push('timestamp-query');
    }

    const device = await adapter.requestDevice({ requiredLimits, requiredFeatures });
    device.lost.then((info) => {
      // Surfaced rather than swallowed: a lost device invalidates every buffer.
      console.error('[gridlift] GPU device lost:', info.reason, info.message);
    });
    return new GpuContext(adapter, device);
  }

  /**
   * Largest square-ish working resolution that fits the binding limit given how
   * many bytes-per-pixel the widest intermediate needs (f32 = 4).
   */
  maxWorkingPixels(bytesPerPixel = 4) {
    const cap = Math.min(this.limits.maxStorageBufferBindingSize, this.limits.maxBufferSize);
    return Math.floor(cap / bytesPerPixel);
  }

  /** Compute pipelines are cached by (label, entryPoint) - shader text is stable per label. */
  computePipeline(label, code, entryPoint = 'main') {
    const key = `${label}::${entryPoint}`;
    let p = this._pipelines.get(key);
    if (p) return p;
    const module = this.device.createShaderModule({ label, code });
    p = this.device.createComputePipeline({
      label: key,
      layout: 'auto',
      compute: { module, entryPoint },
    });
    this._pipelines.set(key, p);
    return p;
  }

  destroy() {
    this._pipelines.clear();
    this.device.destroy?.();
  }
}
