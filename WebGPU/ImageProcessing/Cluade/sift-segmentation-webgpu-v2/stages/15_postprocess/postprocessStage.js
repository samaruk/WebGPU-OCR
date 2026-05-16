// postprocessStage.js — bounding boxes, filter, polygons + final render
import { makeBBoxReducePipeline }        from './boundingBoxReduce.js';
import { makeAspectRatioFilterPipeline } from './aspectRatioFilter.js';
import { makePolygonApproxPipeline }     from './polygonApprox.js';
import { ceilDiv }                       from '../00_common/math.js';
import { blitLabelBufferToCanvas }       from '../../core/dispatch.js';
import { Config }                        from '../../config.js';

export class PostprocessStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [bb,ar,pa]=await Promise.all([
      makeBBoxReducePipeline(this.#device,loadShader),
      makeAspectRatioFilterPipeline(this.#device,loadShader),
      makePolygonApproxPipeline(this.#device,loadShader),
    ]);
    this.#pls={bb,ar,pa};
  }

  encode(enc, mem, numLabels=Config.MAX_LABELS){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const W=mem.W; const H=mem.H; const N=W*H; const NL=numLabels;
    const wgN=ceilDiv(N,256); const wgL=ceilDiv(NL,256);
    const uni=(arr)=>{ const b=d.createBuffer({size:Math.max(arr.byteLength,16),usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(b,0,arr); return b; };

    // Init bboxes to large values
    const initBbox=new Uint32Array(NL*8).fill(0xFFFFFFFF);
    for(let i=0;i<NL;i++){initBbox[i*8+2]=0;initBbox[i*8+3]=0;initBbox[i*8+4]=0;}
    q.writeBuffer(mem.bboxBuf,0,initBbox);
    q.writeBuffer(mem.keepBuf,0,new Uint32Array(NL));

    const bbUni=uni(new Uint32Array([N,W,NL,0]));
    const bbBG=d.createBindGroup({layout:this.#pls.bb.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:bbUni}},{binding:1,resource:{buffer:mem.relabelBuf}},
      {binding:2,resource:{buffer:mem.bboxBuf}},
    ]});
    const p0=enc.beginComputePass({label:'bboxReduce'}); p0.setPipeline(this.#pls.bb); p0.setBindGroup(0,bbBG); p0.dispatchWorkgroups(wgN); p0.end();

    const arData=new ArrayBuffer(16); const aru=new Uint32Array(arData); const arf=new Float32Array(arData);
    aru[0]=NL;aru[1]=Config.MIN_AREA;arf[2]=Config.ASPECT_MIN;arf[3]=Config.ASPECT_MAX;
    const arUni=uni(arData);
    const arBG=d.createBindGroup({layout:this.#pls.ar.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:arUni}},{binding:1,resource:{buffer:mem.bboxBuf}},{binding:2,resource:{buffer:mem.keepBuf}},
    ]});
    const p1=enc.beginComputePass({label:'arFilter'}); p1.setPipeline(this.#pls.ar); p1.setBindGroup(0,arBG); p1.dispatchWorkgroups(wgL); p1.end();

    const paUni=uni(new Uint32Array([NL,0,0,0]));
    const paBG=d.createBindGroup({layout:this.#pls.pa.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:paUni}},{binding:1,resource:{buffer:mem.bboxBuf}},
      {binding:2,resource:{buffer:mem.keepBuf}},{binding:3,resource:{buffer:mem.polyBuf}},
    ]});
    const p2=enc.beginComputePass({label:'polyApprox'}); p2.setPipeline(this.#pls.pa); p2.setBindGroup(0,paBG); p2.dispatchWorkgroups(wgL); p2.end();
  }

  visualize(mem, canvas, numLabels=256){
    // Draw coloured labels + bounding boxes
    const W=mem.W; const H=mem.H; const NL=numLabels;
    canvas.width=W; canvas.height=H;
    const d=this.#device; const q=this.#queue;
    const stage=d.createBuffer({size:W*H*4+NL*32+NL*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.relabelBuf,0,stage,0,W*H*4);
    enc.copyBufferToBuffer(mem.bboxBuf,0,stage,W*H*4,NL*32);
    enc.copyBufferToBuffer(mem.keepBuf,0,stage,W*H*4+NL*32,NL*4);
    q.submit([enc.finish()]);
    stage.mapAsync(GPUMapMode.READ).then(()=>{
      const raw=stage.getMappedRange();
      const labels=new Uint32Array(raw,0,W*H);
      const bboxes=new Uint32Array(raw,W*H*4,NL*8);
      const keep  =new Uint32Array(raw,W*H*4+NL*32,NL);
      stage.unmap(); stage.destroy();
      const ctx=canvas.getContext('2d');
      // Draw label colours
      const rgba=new Uint8ClampedArray(W*H*4);
      for(let i=0;i<W*H;i++){
        const l=labels[i]; if(l===0){rgba[i*4+3]=255;continue;}
        const h=(l*0.618033988)%1;
        const r=(h*6|0)%6; const f=h*6-Math.floor(h*6);
        const p=0.15,q2=1-f*0.85,t=1-(1-f)*0.85,v=0.9;
        const rgb=[[v,t,p],[q2,v,p],[p,v,t],[p,q2,v],[t,p,v],[v,p,q2]][r];
        rgba[i*4]=rgb[0]*255|0; rgba[i*4+1]=rgb[1]*255|0; rgba[i*4+2]=rgb[2]*255|0; rgba[i*4+3]=200;
      }
      ctx.putImageData(new ImageData(rgba,W,H),0,0);
      // Draw bounding boxes for kept components
      ctx.lineWidth=1.5;
      for(let l=1;l<NL;l++){
        if(!keep[l]) continue;
        const o=l*8;
        const x0=bboxes[o],y0=bboxes[o+1],x1=bboxes[o+2],y1=bboxes[o+3];
        if(x0===0xFFFFFFFF) continue;
        ctx.strokeStyle=`hsl(${(l*137)%360},90%,60%)`;
        ctx.strokeRect(x0,y0,x1-x0,y1-y0);
      }
    });
  }
}
