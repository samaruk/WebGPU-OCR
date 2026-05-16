// core/pipelineFactory.js — Creates and caches WebGPU compute pipelines

export class PipelineFactory {
  constructor(device) {
    this.device = device;
    this._cache = new Map();
  }

  /**
   * Create or retrieve a cached compute pipeline.
   * @param {string} key - Unique cache key
   * @param {string} wgsl - WGSL shader source
   * @param {string} [entryPoint='main'] - Entry point name
   * @returns {GPUComputePipeline}
   */
  async getComputePipeline(key, wgsl, entryPoint = 'main') {
    if (this._cache.has(key)) return this._cache.get(key);

    const module = this.device.createShaderModule({
      label: key,
      code: wgsl,
    });

    // Check for compilation errors
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      const msg = errors.map(e => `Line ${e.lineNum}: ${e.message}`).join('\n');
      throw new Error(`Shader compilation error in "${key}":\n${msg}`);
    }

    const pipeline = await this.device.createComputePipelineAsync({
      label: key,
      layout: 'auto',
      compute: { module, entryPoint },
    });

    this._cache.set(key, pipeline);
    return pipeline;
  }

  /**
   * Create a bind group from a pipeline and bindings array.
   * @param {GPUComputePipeline} pipeline
   * @param {Array} bindings - Array of {binding, resource} objects
   * @param {number} [groupIndex=0]
   */
  createBindGroup(pipeline, bindings, groupIndex = 0) {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(groupIndex),
      entries: bindings.map(({ binding, resource }) => ({ binding, resource })),
    });
  }

  clearCache() {
    this._cache.clear();
  }

  destroy() {
    this.clearCache();
  }
}
