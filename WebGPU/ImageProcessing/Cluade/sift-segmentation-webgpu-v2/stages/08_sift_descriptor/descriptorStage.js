// descriptorStage.js — build + normalize descriptors, compact keypoints
import { makeDescHistPipeline }     from './descriptorHistogram.js';
import { makeDescNormPipeline }     from './descriptorNormalize.js';
import { makeKPCompactionPipeline } from './keypointCompaction.js';
import { ceilDiv }                  from '../00_common/math.js';
import { Config }                   from '../../config.js';

export class DescriptorStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [dh,dn,kc]=await Promise.all([
      makeDescHistPipeline(this.#device,loadShader),
      makeDescNormPipeline(this.#device,loadShader),
      makeKPCompactionPipeline(this.#device,loadShader),
    ]);
    this.#pls={dh,dn,kc};
  }

  encode(enc, mem, kpCount){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const W=mem.W; const H=mem.H;

    // Descriptor histogram
    const dhData=new ArrayBuffer(32); const dhu=new Uint32Array(dhData); const dhf=new Float32Array(dhData);
    dhu[0]=W;dhu[1]=H;dhu[2]=kpCount;dhf[3]=Config.DESC_SCALE_MUL;dhu[4]=Config.DESC_WIDTH;dhu[5]=Config.DESC_HIST_BINS;
    const dhUni=d.createBuffer({size:32,usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(dhUni,0,dhData);
    const dhBG=d.createBindGroup({layout:this.#pls.dh.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:dhUni}},
      {binding:1,resource:{buffer:mem.kpFinalBuf}},
      {binding:2,resource:{buffer:mem.magBuf}},
      {binding:3,resource:{buffer:mem.oriBuf}},
      {binding:4,resource:{buffer:mem.descBuf}},
    ]});
    const p0=enc.beginComputePass({label:'descHist'});
    p0.setPipeline(this.#pls.dh); p0.setBindGroup(0,dhBG);
    p0.dispatchWorkgroups(kpCount); p0.end();

    // Normalize
    const dnData=new ArrayBuffer(16); new Uint32Array(dnData)[0]=kpCount; new Float32Array(dnData)[1]=Config.DESC_MAG_THR;
    const dnUni=d.createBuffer({size:16,usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(dnUni,0,dnData);
    const dnBG=d.createBindGroup({layout:this.#pls.dn.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:dnUni}},
      {binding:1,resource:{buffer:mem.descBuf}},
    ]});
    const p1=enc.beginComputePass({label:'descNorm'});
    p1.setPipeline(this.#pls.dn); p1.setBindGroup(0,dnBG);
    p1.dispatchWorkgroups(kpCount); p1.end();
  }

  visualize(mem, canvas, kpCount){
    // Draw descriptor fingerprint heatmap for first N keypoints
    const N=Math.min(kpCount,32);
    canvas.width=128; canvas.height=N;
    canvas.style.imageRendering='pixelated';
    const d=this.#device; const q=this.#queue;
    const stage=d.createBuffer({size:N*128*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.descBuf,0,stage,0,N*128*4);
    q.submit([enc.finish()]);
    stage.mapAsync(GPUMapMode.READ).then(()=>{
      const f=new Float32Array(stage.getMappedRange());
      stage.unmap(); stage.destroy();
      const ctx=canvas.getContext('2d');
      const imgData=ctx.createImageData(128,N);
      for(let i=0;i<N*128;i++){
        const v=Math.min(1,Math.max(0,f[i]));
        const r=v>0.5?(v-0.5)*510:0;
        const g=v<0.5?v*255:255-(v-0.5)*510;
        imgData.data[i*4  ]=r; imgData.data[i*4+1]=g; imgData.data[i*4+2]=120; imgData.data[i*4+3]=255;
      }
      ctx.putImageData(imgData,0,0);
    });
  }
}
