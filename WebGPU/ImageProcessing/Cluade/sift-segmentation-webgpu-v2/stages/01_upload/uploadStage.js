// uploadStage.js — copy image → GPU gray buffer
import { makeTextureUploadPipeline } from './textureUpload.js';
import { blitBufferToCanvas } from '../../core/dispatch.js';
import { ceilDiv } from '../00_common/math.js';

export class UploadStage {
  #pl; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader) {
    this.#pl = await makeTextureUploadPipeline(this.#device, loadShader);
  }

  encode(enc, mem) {
    const d=this.#device; const W=mem.W; const H=mem.H;
    const uni=d.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.#queue.writeBuffer(uni,0,new Uint32Array([W,H,0,0]));
    const bg=d.createBindGroup({layout:this.#pl.getBindGroupLayout(0),entries:[
      {binding:0,resource:mem.srcTex.createView()},
      {binding:1,resource:{buffer:mem.grayBuf}},
      {binding:2,resource:{buffer:uni}},
    ]});
    const p=enc.beginComputePass({label:'upload'});
    p.setPipeline(this.#pl); p.setBindGroup(0,bg);
    p.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p.end();
  }

  visualize(mem, canvas) {
    blitBufferToCanvas(this.#device, this.#queue, mem.grayBuf, mem.W, mem.H, canvas);
  }
}
