// core/texturePool.js
export class TexturePool {
  #device; #free=[]; #all=[];
  constructor(device){ this.#device=device; }
  acquire(width,height,format,usage,label=''){
    const idx=this.#free.findIndex(e=>e.width===width&&e.height===height&&e.format===format&&e.usage===usage);
    if(idx!==-1){ const [e]=this.#free.splice(idx,1); return e.tex; }
    const tex=this.#device.createTexture({label,size:[width,height],format,usage});
    this.#all.push({width,height,format,usage,tex}); return tex;
  }
  release(tex){ const e=this.#all.find(e=>e.tex===tex); if(e&&!this.#free.includes(e)) this.#free.push(e); }
  destroy(){ this.#all.forEach(e=>e.tex.destroy()); this.#all=[]; this.#free=[]; }
}
