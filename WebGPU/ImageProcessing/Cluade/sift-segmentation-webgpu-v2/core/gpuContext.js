// core/gpuContext.js
export class GPUContext {
  adapter=null; device=null; queue=null; info=null;
  async init(opts={}) {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    this.adapter = await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if (!this.adapter) throw new Error('No GPU adapter'); {
          //this.info = await this.adapter.requestAdapterInfo().catch(() => null);

          // Gather adapter info
          try {
              this.info = await this.adapter.requestAdapterInfo();
          } catch {
              this.info = { vendor: 'unknown', device: 'unknown' };
          }
      }

    const feats = (opts.features??[]).filter(f=>this.adapter.features.has(f));
    this.device = await this.adapter.requestDevice({
      requiredFeatures: feats,
      requiredLimits: opts.limits??{},
    });
    this.queue = this.device.queue;
    this.device.addEventListener('uncapturederror', e=>console.error('[GPU]',e.error));
    this.device.lost.then(i=>console.warn('[GPU lost]',i.reason,i.message));
    console.info('[GPU ready]', this.info?.vendor, this.info?.device);
    return this;
  }
  buf(desc){ return this.device.createBuffer(desc); }
  tex(desc){ return this.device.createTexture(desc); }
  submit(enc){ this.queue.submit([enc.finish()]); }
  write(buf,data,off=0){ this.queue.writeBuffer(buf,off,data); }
  async readback(buf,off=0,size){
    const n=size??buf.size;
    const s=this.device.createBuffer({size:n,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const e=this.device.createCommandEncoder();
    e.copyBufferToBuffer(buf,off,s,0,n); this.submit(e);
    await s.mapAsync(GPUMapMode.READ);
    const r=s.getMappedRange().slice(0); s.unmap(); s.destroy(); return r;
  }
  destroy(){ this.device?.destroy(); }
}
