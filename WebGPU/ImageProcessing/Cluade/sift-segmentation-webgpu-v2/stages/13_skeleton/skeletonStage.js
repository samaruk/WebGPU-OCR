// skeletonStage.js — Zhang-Suen thinning + endpoint detection
import { makeThinningPassAPipeline }  from './thinningPassA.js';
import { makeThinningPassBPipeline }  from './thinningPassB.js';
import { makeEndpointDetectPipeline } from './endpointDetect.js';
import { ceilDiv }                    from '../00_common/math.js';
import { Config }                     from '../../config.js';

export class SkeletonStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [pA,pB,ep]=await Promise.all([
      makeThinningPassAPipeline(this.#device,loadShader),
      makeThinningPassBPipeline(this.#device,loadShader),
      makeEndpointDetectPipeline(this.#device,loadShader),
    ]);
    this.#pls={pA,pB,ep};
  }

  encode(enc, mem){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const W=mem.W; const H=mem.H;
    const wgX=ceilDiv(W,8); const wgY=ceilDiv(H,8);

    // Copy binary → skel
    enc.copyBufferToBuffer(mem.binaryBuf,0,mem.skelBuf,0,W*H*4);

    const uni=d.createBuffer({size:16,usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(uni,0,new Uint32Array([W,H,0,0]));

    const bgA=d.createBindGroup({layout:this.#pls.pA.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:uni}},{binding:1,resource:{buffer:mem.skelBuf}},
      {binding:2,resource:{buffer:mem.markBuf}},{binding:3,resource:{buffer:mem.changedBuf}},
    ]});
    const bgB=d.createBindGroup({layout:this.#pls.pB.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:uni}},{binding:1,resource:{buffer:mem.markBuf}},
      {binding:2,resource:{buffer:mem.skelBuf}},
    ]});

    for(let i=0;i<Config.SKEL_ITERS;i++){
      const a=enc.beginComputePass({label:`skelA_${i}`}); a.setPipeline(this.#pls.pA); a.setBindGroup(0,bgA); a.dispatchWorkgroups(wgX,wgY); a.end();
      const b=enc.beginComputePass({label:`skelB_${i}`}); b.setPipeline(this.#pls.pB); b.setBindGroup(0,bgB); b.dispatchWorkgroups(wgX,wgY); b.end();
    }

    const epBG=d.createBindGroup({layout:this.#pls.ep.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:uni}},{binding:1,resource:{buffer:mem.skelBuf}},
      {binding:2,resource:{buffer:mem.endpBuf}},
    ]});
    const pe=enc.beginComputePass({label:'endpDetect'}); pe.setPipeline(this.#pls.ep); pe.setBindGroup(0,epBG); pe.dispatchWorkgroups(wgX,wgY); pe.end();
  }

  visualize(mem, canvas){
    const W=mem.W; const H=mem.H;
    canvas.width=W; canvas.height=H;
    const d=this.#device; const q=this.#queue;
    const stage=d.createBuffer({size:W*H*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.skelBuf,0,stage,0,W*H*4);
    enc.copyBufferToBuffer(mem.endpBuf,0,stage,W*H*4,W*H*4);
    q.submit([enc.finish()]);
    stage.mapAsync(GPUMapMode.READ).then(()=>{
      const raw=stage.getMappedRange();
      const skel=new Uint32Array(raw,0,W*H);
      const endp=new Uint32Array(raw,W*H*4,W*H);
      const rgba=new Uint8ClampedArray(W*H*4);
      for(let i=0;i<W*H;i++){
        if(endp[i]){rgba[i*4]=255;rgba[i*4+1]=80;rgba[i*4+2]=80;rgba[i*4+3]=255;}
        else if(skel[i]){rgba[i*4]=240;rgba[i*4+1]=240;rgba[i*4+2]=240;rgba[i*4+3]=255;}
        else{rgba[i*4+3]=255;}
      }
      stage.unmap(); stage.destroy();
      canvas.getContext('2d').putImageData(new ImageData(rgba,W,H),0,0);
    });
  }
}
