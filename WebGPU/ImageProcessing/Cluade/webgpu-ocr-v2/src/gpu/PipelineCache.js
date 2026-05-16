// Compute pipeline cache: avoid recompiling same shader+entry
import { compileShader } from './ShaderLoader.js';

export class PipelineCache {
  constructor(device) { this.device = device; this._cache = new Map(); }

  async get(shaderURL, entryPoint = 'main', layout = 'auto') {
    const key = `${shaderURL}::${entryPoint}`;
    if (this._cache.has(key)) return this._cache.get(key);
    const module = await compileShader(this.device, shaderURL);
    const pipeline = await this.device.createComputePipelineAsync({
      label: key, layout,
      compute: { module, entryPoint },
    });
    this._cache.set(key, pipeline);
    return pipeline;
  }

  async warmup(entries) {
    await Promise.all(entries.map(e => this.get(e.url, e.entry ?? 'main', e.layout ?? 'auto')));
  }

  clear() { this._cache.clear(); }
}