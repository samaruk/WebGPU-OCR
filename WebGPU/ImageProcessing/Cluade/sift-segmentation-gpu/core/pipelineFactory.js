/**
 * core/pipelineFactory.js – cached compute / render pipeline compiler.
 */
export class PipelineFactory {
  #device; #computeCache = new Map(); #renderCache = new Map();
  constructor(device) { this.#device = device; }

  async computePipeline(wgslSource, entryPoint = 'main', layout = 'auto') {
    const key = `${entryPoint}::${hash(wgslSource)}`;
    if (this.#computeCache.has(key)) return this.#computeCache.get(key);
    const module = this.#device.createShaderModule({ code: wgslSource });
    const p = await this.#device.createComputePipelineAsync({ layout, compute: { module, entryPoint } });
    this.#computeCache.set(key, p);
    return p;
  }

  async renderPipeline(desc) {
    const key = JSON.stringify(desc).slice(0, 128);
    if (this.#renderCache.has(key)) return this.#renderCache.get(key);
    const p = await this.#device.createRenderPipelineAsync(desc);
    this.#renderCache.set(key, p);
    return p;
  }
  clearCache() { this.#computeCache.clear(); this.#renderCache.clear(); }
}
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i); return (h >>> 0).toString(16); }
