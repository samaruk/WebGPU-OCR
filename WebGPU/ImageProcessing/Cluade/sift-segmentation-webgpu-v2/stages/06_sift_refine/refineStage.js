// refineStage.js
import { makeSubpixelRefinePipeline } from './subpixelRefine.js';
import { ceilDiv } from '../00_common/math.js';
import { Config }  from '../../config.js';

export class RefineStage {
  #pl; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }
  async init(loadShader){ this.#pl=await makeSubpixelRefinePipeline(this.#device,loadShader); }

  encode(enc, mem, kpCount){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    q.writeBuffer(mem.kpCtr,0,new Uint32Array([0]));
    const uni=d.createBuffer({size:32,usage:U.UNIFORM|U.COPY_DST});
    const udata=new ArrayBuffer(32); const uu=new Uint32Array(udata); const uf=new Float32Array(udata);
    uu[0]=mem.W;uu[1]=mem.H;uu[2]=kpCount;uf[3]=Config.SIGMA_BASE;uu[4]=0;uu[5]=2;
    q.writeBuffer(uni,0,udata);
    const bg=d.createBindGroup({layout:this.#pl.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:uni}},
      {binding:1,resource:{buffer:mem.dogLevels[0][0]}},
      {binding:2,resource:{buffer:mem.dogLevels[0][1]}},
      {binding:3,resource:{buffer:mem.dogLevels[0][2]}},
      {binding:4,resource:{buffer:mem.kpPackedBuf}},
      {binding:5,resource:{buffer:mem.kpCtr}},
      {binding:6,resource:{buffer:mem.kpRefinedBuf}},
    ]});
    const p=enc.beginComputePass({label:'subpixelRefine'});
    p.setPipeline(this.#pl); p.setBindGroup(0,bg);
    p.dispatchWorkgroups(ceilDiv(kpCount,256)); p.end();
  }

  visualize(mem, canvas){
    const W=mem.W; const H=mem.H;
    canvas.width=W; canvas.height=H;
    const d=this.#device; const q=this.#queue;
    // Draw refined keypoints as crosshairs
    const sz=Config.MAX_KP;
    const stage=d.createBuffer({size:sz*16+4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.kpRefinedBuf,0,stage,0,sz*16);
    enc.copyBufferToBuffer(mem.kpCtr,0,stage,sz*16,4);
    q.submit([enc.finish()]);
    stage.mapAsync(GPUMapMode.READ).then(()=>{
      const raw=stage.getMappedRange();
      const f32=new Float32Array(raw,0,sz*4);
      const cnt=new Uint32Array(raw,sz*16,1)[0];
      stage.unmap(); stage.destroy();
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#0a0a12'; ctx.fillRect(0,0,W,H);
      const n=Math.min(cnt,sz);
      for(let i=0;i<n;i++){
        const x=f32[i*4],y=f32[i*4+1],s=f32[i*4+2];
        const r=s*3;
        ctx.strokeStyle=`hsla(${(s*30)%360},80%,65%,0.9)`;
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-r,y); ctx.lineTo(x+r,y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x,y+r); ctx.stroke();
      }
    });
  }
}
