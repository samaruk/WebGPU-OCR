/**
 * core/gpuContext.js – WebGPU adapter/device initialisation + sub-system bundle.
 */
import { PipelineFactory } from './pipelineFactory.js';
import { BufferManager }   from './bufferManager.js';
import { TextureManager }  from './textureManager.js';
import { MemoryPool }      from './memoryPool.js';

export class GPUContext {
  constructor(adapter, device) {
    this.adapter         = adapter;
    this.device          = device;
    this.queue           = device.queue;
    this.pipelineFactory = new PipelineFactory(device);
    this.bufferManager   = new BufferManager(device);
    this.textureManager  = new TextureManager(device);
    this.memoryPool      = new MemoryPool(device);
  }

  static async create(options = {}) {
    if (!navigator.gpu) throw new Error('WebGPU not supported in this browser.');
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: options.powerPreference ?? 'high-performance',
    });
    if (!adapter) throw new Error('No WebGPU adapter found.');
    const features = [];
    if (adapter.features.has('timestamp-query')) features.push('timestamp-query');
    const device = await adapter.requestDevice({
      requiredFeatures: features,
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize:               adapter.limits.maxBufferSize,
      },
    });
    device.addEventListener('uncapturederror', e => console.error('[WebGPU]', e.error));
    return new GPUContext(adapter, device);
  }

  createEncoder(label = '') { return this.device.createCommandEncoder({ label }); }
  submit(encoder)           { this.queue.submit([encoder.finish()]); }
  async submitAndWait(encoder) { this.submit(encoder); await this.device.queue.onSubmittedWorkDone(); }

  destroy() {
    this.memoryPool.destroy();
    this.bufferManager.destroy();
    this.textureManager.destroy();
    this.device.destroy();
  }
}
