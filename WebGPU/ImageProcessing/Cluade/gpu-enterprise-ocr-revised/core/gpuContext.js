
export class GPUContext {
  constructor() { this.adapter = null; this.device = null; }

  async init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported.');
    this.adapter = await navigator.gpu.requestAdapter({ powerPreference:'high-performance' });
    if (!this.adapter) throw new Error('No GPU adapter found.');
    this.device = await this.adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize:               this.adapter.limits.maxBufferSize,
      },
    });
    this.device.lost.then(i => console.error('GPU device lost:', i.message));
    return this;
  }

  get isReady() { return !!this.device; }
}

export const gpuCtx = new GPUContext();
