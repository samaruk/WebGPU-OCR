// extremaStage.js — run extrema detection + filtering pipeline
import { makeExtrema3DPipeline }     from './extrema3D.js';
import { makeContrastRejectPipeline } from './contrastReject.js';
import { makeHessianRejectPipeline }  from './hessianReject.js';
import { ceilDiv }                    from '../00_common/math.js';
import { Config }                     from '../../config.js';

export class ExtremaStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [e,c,h]=await Promise.all([
      makeExtrema3DPipeline(this.#device,loadShader),
      makeContrastRejectPipeline(this.#device,loadShader),
      makeHessianRejectPipeline(this.#device,loadShader),
    ]);
    this.#pls={e,c,h};
  }

  encode(enc, mem){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const scl=Config.SCALES;
    // Temp buffers for filtering chain
    const tmpBuf=d.createBuffer({size:Config.MAX_KP*4,usage:U.STORAGE|U.COPY_DST});
    const tmpCtr=d.createBuffer({size:4,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC});

    for(let o=0;o<Config.OCTAVES;o++){
      const ow=mem.W>>o; const oh=mem.H>>o;
      for(let s=1;s<scl+2;s++){
        // Reset counters
        q.writeBuffer(mem.kpCtr,0,new Uint32Array([0]));
        const extUni=d.createBuffer({size:16,usage:U.UNIFORM|U.COPY_DST});
        const eData=new ArrayBuffer(16); const eu=new Uint32Array(eData); const ef=new Float32Array(eData);
        eu[0]=ow;eu[1]=oh;eu[2]=Config.MAX_KP;ef[3]=Config.CONTRAST_THRESH;
        q.writeBuffer(extUni,0,eData);

        const bg1=d.createBindGroup({layout:this.#pls.e.getBindGroupLayout(0),entries:[
          {binding:0,resource:{buffer:extUni}},
          {binding:1,resource:{buffer:s>0?mem.dogLevels[o][s-1]:mem.dogLevels[o][0]}},
          {binding:2,resource:{buffer:mem.dogLevels[o][s]}},
          {binding:3,resource:{buffer:s<scl+1?mem.dogLevels[o][s+1]:mem.dogLevels[o][s]}},
          {binding:4,resource:{buffer:mem.kpCtr}},
          {binding:5,resource:{buffer:mem.kpPackedBuf}},
        ]});
        const p=enc.beginComputePass({label:`ext_${o}_${s}`});
        p.setPipeline(this.#pls.e); p.setBindGroup(0,bg1);
        p.dispatchWorkgroups(ceilDiv(ow,8),ceilDiv(oh,8)); p.end();
      }
    }
  }

  visualize(mem, canvas){
    // Draw keypoints as dots on a dark background
    const W=mem.W; const H=mem.H;
    canvas.width=W; canvas.height=H;
    const d=this.#device; const q=this.#queue;
    const stage=d.createBuffer({size:Config.MAX_KP*4+4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.kpPackedBuf,0,stage,0,Config.MAX_KP*4);
    enc.copyBufferToBuffer(mem.kpCtr,0,stage,Config.MAX_KP*4,4);
    q.submit([enc.finish()]);
    stage.mapAsync(GPUMapMode.READ).then(()=>{
      const raw=stage.getMappedRange();
      const kps=new Uint32Array(raw,0,Config.MAX_KP);
      const ctr=new Uint32Array(raw,Config.MAX_KP*4,1)[0];
      stage.unmap(); stage.destroy();
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#0a0a12'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='rgba(108,99,255,0.8)';
      const n=Math.min(ctr,Config.MAX_KP);
      for(let i=0;i<n;i++){
        const x=kps[i]>>16; const y=kps[i]&0xFFFF;
        ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill();
      }
      const label=document.createElement('span');
      label.textContent=`${n} keypoints`;
    });
  }
}
