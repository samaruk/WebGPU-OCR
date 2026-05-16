// core/gpuContext.js — WebGPU device initialization and context management

export class GPUContext {
  constructor() {
    this.adapter = null;
    this.device = null;
    this.queue = null;
    this.supported = false;
    this.adapterInfo = null;
  }

  async initialize() {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
    }

    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    if (!this.adapter) {
      throw new Error('No suitable GPU adapter found.');
    }

    // Gather adapter info
    try {
      this.adapterInfo = await this.adapter.requestAdapterInfo();
    } catch {
      this.adapterInfo = { vendor: 'unknown', device: 'unknown' };
    }

    // Request device with all useful features
    const requiredFeatures = [];
    if (this.adapter.features.has('shader-f16')) requiredFeatures.push('shader-f16');

    this.device = await this.adapter.requestDevice({
      requiredFeatures,
      requiredLimits: {
        maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: this.adapter.limits.maxBufferSize,
      },
    });

    this.queue = this.device.queue;

    // Error handling
    this.device.lost.then((info) => {
      console.error(`WebGPU device lost: ${info.message}`);
    });

    this.device.addEventListener('uncapturederror', (event) => {
      console.error('WebGPU uncaptured error:', event.error.message);
    });

    this.supported = true;

    return {
      vendor: this.adapterInfo.vendor,
      architecture: this.adapterInfo.architecture || '',
      device: this.adapterInfo.device,
      limits: {
        maxTextureDimension2D: this.device.limits.maxTextureDimension2D,
        maxComputeWorkgroupSizeX: this.device.limits.maxComputeWorkgroupSizeX,
        maxStorageBufferBindingSize: this.device.limits.maxStorageBufferBindingSize,
      }
    };
  }

  destroy() {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.adapter = null;
    this.supported = false;
  }
}
