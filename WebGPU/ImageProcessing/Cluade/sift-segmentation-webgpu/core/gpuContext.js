// core/gpuContext.js
export class GPUContext {
  adapter=null; device=null; queue=null; adapterInfo=null; limits=null; features=new Set();
  async init(opts={}) {
    if (!navigator.gpu) throw new Error('WebGPU not supported.');
    this.adapter = await navigator.gpu.requestAdapter({ powerPreference:'high-performance' });
    if (!this.adapter) throw new Error('No GPU adapter.');
    this.adapterInfo = await this.adapter.requestAdapterInfo().catch(()=>null);
    const reqF = (opts.requiredFeatures??[]).filter(f=>this.adapter.features.has(f));
    this.device = await this.adapter.requestDevice({ requiredFeatures:reqF, requiredLimits:opts.requiredLimits??{} });
    this.queue=this.device.queue; this.limits=this.device.limits;
    reqF.forEach(f=>this.features.add(f));
    this.device.addEventListener('uncapturederror',e=>console.error('[GPU]',e.error));
    this.device.lost.then(i=>console.warn('[GPU] lost:',i.reason,i.message));
    console.info('[GPUContext] ready',this.adapterInfo);
    return this;
  }
  createBuffer(desc){ return this.device.createBuffer(desc); }
  createTexture(desc){ return this.device.createTexture(desc); }
  submit(enc){ this.queue.submit([enc.finish()]); }
  writeBuffer(buf,data,off=0){ this.queue.writeBuffer(buf,off,data); }
  async readbackBuffer(buf,byteOffset=0,byteSize){
    const size=byteSize??buf.size;
    const stage=this.device.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=this.device.createCommandEncoder();
    enc.copyBufferToBuffer(buf,byteOffset,stage,0,size);
    this.submit(enc);
    await stage.mapAsync(GPUMapMode.READ);
    const copy=stage.getMappedRange().slice(0);
    stage.unmap(); stage.destroy(); return copy;
  }
  destroy(){ this.device?.destroy(); this.device=null; }
}
