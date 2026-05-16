// orientationStage.js
import { makeGradientMapPipeline }       from './gradientMap.js';
import { makeOrientationAssignPipeline } from './orientationAssign.js';
import { ceilDiv }                        from '../00_common/math.js';
import { blitBufferToCanvas }             from '../../core/dispatch.js';
import { Config }                         from '../../config.js';

export class OrientationStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [gm,oa]=await Promise.all([
      makeGradientMapPipeline(this.#device,loadShader),
      makeOrientationAssignPipeline(this.#device,loadShader),
    ]);
    this.#pls={gm,oa};
  }

  encode(enc, mem, kpCount){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const W=mem.W; const H=mem.H;

    // Gradient map on octave-0 level 1
    const gmUni=d.createBuffer({size:16,usage:U.UNIFORM|U.COPY_DST});
    q.writeBuffer(gmUni,0,new Uint32Array([W,H,0,0]));
    const gmBG=d.createBindGroup({layout:this.#pls.gm.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:gmUni}},
      {binding:1,resource:{buffer:mem.pyrLevels[0][1]}},
      {binding:2,resource:{buffer:mem.magBuf}},
      {binding:3,resource:{buffer:mem.oriBuf}},
    ]});
    const p0=enc.beginComputePass({label:'gradMap'});
    p0.setPipeline(this.#pls.gm); p0.setBindGroup(0,gmBG);
    p0.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p0.end();

    // Orientation assign
    q.writeBuffer(mem.kpCtr,0,new Uint32Array([0]));
    const oaData=new ArrayBuffer(32); const ou=new Uint32Array(oaData); const of_=new Float32Array(oaData);
    ou[0]=W;ou[1]=H;ou[2]=kpCount;ou[3]=Config.ORI_BINS;
    of_[4]=Config.ORI_RADIUS;of_[5]=Config.ORI_SIG_FAC;of_[6]=Config.ORI_PEAK_RATIO;
    const oaUni=d.createBuffer({size:32,usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(oaUni,0,oaData);
    const oaBG=d.createBindGroup({layout:this.#pls.oa.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:oaUni}},
      {binding:1,resource:{buffer:mem.kpRefinedBuf}},
      {binding:2,resource:{buffer:mem.magBuf}},
      {binding:3,resource:{buffer:mem.oriBuf}},
      {binding:4,resource:{buffer:mem.kpFinalBuf}},
      {binding:5,resource:{buffer:mem.kpCtr}},
    ]});
    const p1=enc.beginComputePass({label:'oriAssign'});
    p1.setPipeline(this.#pls.oa); p1.setBindGroup(0,oaBG);
    p1.dispatchWorkgroups(kpCount); p1.end();
  }

  visualize(mem, canvas){
    // Draw orientation arrows on keypoints
    const W=mem.W; const H=mem.H;
    canvas.width=W; canvas.height=H;
    const d=this.#device; const q=this.#queue;
    const sz=Config.MAX_KP;
    const stage=d.createBuffer({size:sz*16+4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.kpFinalBuf,0,stage,0,sz*16);
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
        const x=f32[i*4],y=f32[i*4+1],s=f32[i*4+2],a=f32[i*4+3];
        const r=s*3;
        ctx.strokeStyle=`hsla(${(a*180/Math.PI)%360},85%,65%,0.85)`;
        ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x,y);
        ctx.lineTo(x+Math.cos(a)*r*1.5,y+Math.sin(a)*r*1.5); ctx.stroke();
      }
    });
  }
}
