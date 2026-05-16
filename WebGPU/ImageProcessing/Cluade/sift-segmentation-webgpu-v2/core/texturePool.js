// core/texturePool.js
export class TexturePool {
  #d; #free=[]; #all=[];
  constructor(device){ this.#d=device; }
  get(w,h,fmt,usage,label=''){
    const i=this.#free.findIndex(e=>e.w===w&&e.h===h&&e.fmt===fmt&&e.usage===usage);
    if(i!==-1){const[e]=this.#free.splice(i,1);return e.tex;}
    const tex=this.#d.createTexture({label,size:[w,h],format:fmt,usage});
    this.#all.push({w,h,fmt,usage,tex}); return tex;
  }
  ret(tex){const e=this.#all.find(e=>e.tex===tex);if(e&&!this.#free.includes(e))this.#free.push(e);}
  destroy(){this.#all.forEach(e=>e.tex.destroy());this.#all=[];this.#free=[];}
}
