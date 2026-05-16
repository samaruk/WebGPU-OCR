// core/pipelineFactory.js — compile & cache compute pipelines
export class PipelineFactory {
  #d; #c=new Map();
  constructor(device){ this.#d=device; }
  async make(key,wgsl,layouts=[]){
    if(this.#c.has(key)) return this.#c.get(key);
    const mod = this.#d.createShaderModule({label:key,code:wgsl});
    const layout = layouts.length ? this.#d.createPipelineLayout({bindGroupLayouts:layouts}) : 'auto';
    const pl = await this.#d.createComputePipelineAsync({
      label:key, layout, compute:{module:mod, entryPoint:'main'},
    });
    this.#c.set(key,pl); return pl;
  }
  get(key){ return this.#c.get(key); }
  clear(){ this.#c.clear(); }
  get size(){ return this.#c.size; }
}
