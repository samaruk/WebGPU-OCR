// core/pipelineCache.js
export class PipelineCache {
  #device; #cache=new Map();
  constructor(device){ this.#device=device; }
  async get(key,wgsl,bindGroupLayouts=[]){
    if(this.#cache.has(key)) return this.#cache.get(key);
    const module=this.#device.createShaderModule({label:key,code:wgsl});
    const layout=bindGroupLayouts.length
      ? this.#device.createPipelineLayout({bindGroupLayouts})
      : 'auto';
    const p=await this.#device.createComputePipelineAsync({
      label:key, layout, compute:{module,entryPoint:'main'},
    });
    this.#cache.set(key,p); return p;
  }
  evict(key){ this.#cache.delete(key); }
  clear(){ this.#cache.clear(); }
  get size(){ return this.#cache.size; }
}
