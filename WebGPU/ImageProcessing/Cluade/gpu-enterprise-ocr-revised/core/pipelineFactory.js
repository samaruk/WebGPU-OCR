
export class PipelineFactory {
  constructor(device) { this.device = device; this._cache = new Map(); }

  compute(shaderCode, entryPoint = 'main', label = '') {
    const key = `${entryPoint}::${shaderCode.length}`;
    if (this._cache.has(key)) return this._cache.get(key);
    const module = this.device.createShaderModule({ label, code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      label, layout:'auto', compute:{ module, entryPoint },
    });
    this._cache.set(key, pipeline);
    return pipeline;
  }
}
