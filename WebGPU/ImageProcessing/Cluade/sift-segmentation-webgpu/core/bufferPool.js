// core/bufferPool.js
export class BufferPool {
  #device; #free=[]; #all=[];
  constructor(device){ this.#device=device; }
  acquire(size,usage,label=''){
    const aligned=Math.ceil(size/256)*256;
    const idx=this.#free.findIndex(e=>e.size>=aligned&&e.usage===usage);
    if(idx!==-1){ const [e]=this.#free.splice(idx,1); return e.buf; }
    const buf=this.#device.createBuffer({label,size:aligned,usage});
    this.#all.push({size:aligned,usage,buf}); return buf;
  }
  release(buf){ const e=this.#all.find(e=>e.buf===buf); if(e&&!this.#free.includes(e)) this.#free.push(e); }
  destroy(){ this.#all.forEach(e=>e.buf.destroy()); this.#all=[]; this.#free=[]; }
  get stats(){ return {total:this.#all.length,free:this.#free.length}; }
}
