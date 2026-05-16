// strokeStage.js — gradient mag + stroke width transform + consistency
import { makeGradMagPipeline }           from './gradientMagnitude.js';
import { makeStrokeWidthPipeline }       from './strokeWidth.js';
import { makeStrokeConsistencyPipeline } from './strokeConsistency.js';
import { ceilDiv }                       from '../00_common/math.js';
import { Config }                        from '../../config.js';

export class StrokeStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [gm,sw,sc]=await Promise.all([
      makeGradMagPipeline(this.#device,loadShader),
      makeStrokeWidthPipeline(this.#device,loadShader),
      makeStrokeConsistencyPipeline(this.#device,loadShader),
    ]);
    this.#pls={gm,sw,sc};
  }

  encode(enc, mem){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const W=mem.W; const H=mem.H;

    const uni16=(arr)=>{ const b=d.createBuffer({size:Math.max(arr.byteLength,16),usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(b,0,arr); return b; };

    const gmUni=uni16(new Uint32Array([W,H,0,0]));
    const gmBG=d.createBindGroup({layout:this.#pls.gm.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:gmUni}},
      {binding:1,resource:{buffer:mem.blurBuf}},
      {binding:2,resource:{buffer:mem.gradMagBuf}},
      {binding:3,resource:{buffer:mem.gradAngBuf}},
    ]});
    const p0=enc.beginComputePass({label:'gradMag'});
    p0.setPipeline(this.#pls.gm); p0.setBindGroup(0,gmBG);
    p0.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p0.end();

    const swData=new ArrayBuffer(32); const swu=new Uint32Array(swData); const swf=new Float32Array(swData);
    swu[0]=W;swu[1]=H;swu[2]=Config.RAY_STEPS;swf[3]=Config.MAX_STROKE;swf[4]=Config.MIN_STROKE;
    const swUni=uni16(swData);
    const swBG=d.createBindGroup({layout:this.#pls.sw.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:swUni}},
      {binding:1,resource:{buffer:mem.gradMagBuf}},
      {binding:2,resource:{buffer:mem.gradAngBuf}},
      {binding:3,resource:{buffer:mem.swtBuf}},
    ]});
    const p1=enc.beginComputePass({label:'strokeWidth'});
    p1.setPipeline(this.#pls.sw); p1.setBindGroup(0,swBG);
    p1.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p1.end();

    const scData=new ArrayBuffer(16); new Uint32Array(scData)[0]=W; new Uint32Array(scData)[1]=H; new Float32Array(scData)[2]=Config.CONSIST_THRESH;
    const scUni=uni16(scData);
    const scBG=d.createBindGroup({layout:this.#pls.sc.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:scUni}},
      {binding:1,resource:{buffer:mem.swtBuf}},
      {binding:2,resource:{buffer:mem.labelBuf}},
      {binding:3,resource:{buffer:mem.consistBuf}},
    ]});
    const p2=enc.beginComputePass({label:'strokeConsist'});
    p2.setPipeline(this.#pls.sc); p2.setBindGroup(0,scBG);
    p2.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p2.end();
  }

  visualize(mem, canvas){
    // Jet heatmap of SWT
    const W=mem.W; const H=mem.H;
    canvas.width=W; canvas.height=H;
    const d=this.#device; const q=this.#queue;
    const stage=d.createBuffer({size:W*H*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.swtBuf,0,stage,0,W*H*4);
    q.submit([enc.finish()]);
    stage.mapAsync(GPUMapMode.READ).then(()=>{
      const f=new Float32Array(stage.getMappedRange());
      const rgba=new Uint8ClampedArray(W*H*4);
      for(let i=0;i<W*H;i++){
        const v=Math.min(1,Math.max(0,f[i]/Config.MAX_STROKE));
        rgba[i*4  ]=Math.max(0,Math.min(255,1.5-Math.abs(4*v-3))*255)|0;
        rgba[i*4+1]=Math.max(0,Math.min(255,1.5-Math.abs(4*v-2))*255)|0;
        rgba[i*4+2]=Math.max(0,Math.min(255,1.5-Math.abs(4*v-1))*255)|0;
        rgba[i*4+3]=255;
      }
      stage.unmap(); stage.destroy();
      canvas.getContext('2d').putImageData(new ImageData(rgba,W,H),0,0);
    });
  }
}
