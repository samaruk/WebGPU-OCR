// core/bufferPool.js
export class BufferPool {
  #d; #free=[]; #all=[];
  constructor(device){ this.#d=device; }
  get(size,usage,label=''){
    const a=Math.ceil(size/256)*256;
    const i=this.#free.findIndex(e=>e.size>=a&&e.usage===usage);
    if(i!==-1){const[e]=this.#free.splice(i,1);return e.buf;}
    const buf=this.#d.createBuffer({label,size:a,usage});
    this.#all.push({size:a,usage,buf}); return buf;
  }
  ret(buf){const e=this.#all.find(e=>e.buf===buf);if(e&&!this.#free.includes(e))this.#free.push(e);}
  destroy(){this.#all.forEach(e=>e.buf.destroy());this.#all=[];this.#free=[];}
}
