/**
 * core/pipelineBuilder.js - Creates and caches WebGPU compute pipelines.
 */
export class PipelineBuilder {
  constructor(device) {
    this.device = device;
    this._cache = new Map();
  }

  async build(label, wgslCode, entryPoint = "main") {
    const key = `${label}::${entryPoint}`;
    if (this._cache.has(key)) return this._cache.get(key);
    const module = this.device.createShaderModule({ label, code: wgslCode });
    const info = await module.getCompilationInfo();
    for (const msg of info.messages) {
      if (msg.type === "error") throw new Error(`[${label}] WGSL error L${msg.lineNum}: ${msg.message}`);
    }
    const pipeline = await this.device.createComputePipelineAsync({
      label, layout: "auto",
      compute: { module, entryPoint },
    });
    this._cache.set(key, pipeline);
    return pipeline;
  }

  buildBindGroup(pipeline, resources, groupIndex = 0) {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(groupIndex),
      entries: resources.map((resource, binding) => ({ binding, resource })),
    });
  }

  clear() { this._cache.clear(); }
}
