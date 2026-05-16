// core/bindGroupFactory.js — convenience bind-group helpers
export class BindGroupFactory {
  #d;
  constructor(device){ this.#d=device; }

  /** entries: [{buf},{buf,offset,size}] or [{tex}] or [{sampler}] */
  make(pipeline, groupIndex=0, resources=[]) {
    const layout = pipeline.getBindGroupLayout(groupIndex);
    const entries = resources.map((r,i)=>{
      if (r.buffer) return { binding:i, resource:{buffer:r.buffer, offset:r.offset??0, size:r.size??r.buffer.size} };
      if (r.texture) return { binding:i, resource: r.texture.createView(r.viewDesc??{}) };
      if (r.sampler) return { binding:i, resource: r.sampler };
      throw new Error('Unknown resource type at binding '+i);
    });
    return this.#d.createBindGroup({layout, entries});
  }
}

export const ceilDiv = (n,d) => Math.ceil(n/d);
