// clusteringStage.js — density map + label propagation
import { makeDensityMapPipeline }    from './densityMap.js';
import { makeDescSimilarityPipeline } from './descriptorSimilarity.js';
import { ceilDiv }                   from '../00_common/math.js';
import { blitBufferToCanvas }        from '../../core/dispatch.js';
import { Config }                    from '../../config.js';

export class ClusteringStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [dm]=await Promise.all([makeDensityMapPipeline(this.#device,loadShader)]);
    this.#pls={dm};
  }

  encode(enc, mem, kpCount){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    q.writeBuffer(mem.densityBuf,0,new Float32Array(mem.W*mem.H)); // clear
    const r=Math.ceil(Config.DENSITY_SIGMA*3);
    const dmData=new ArrayBuffer(32); const dmu=new Uint32Array(dmData); const dmf=new Float32Array(dmData);
    dmu[0]=mem.W;dmu[1]=mem.H;dmu[2]=kpCount;dmf[3]=Config.DENSITY_SIGMA;dmu[4]=r;
    const dmUni=d.createBuffer({size:32,usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(dmUni,0,dmData);
    const dmBG=d.createBindGroup({layout:this.#pls.dm.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:dmUni}},
      {binding:1,resource:{buffer:mem.kpFinalBuf}},
      {binding:2,resource:{buffer:mem.densityBuf}},
    ]});
    const p=enc.beginComputePass({label:'densityMap'});
    p.setPipeline(this.#pls.dm); p.setBindGroup(0,dmBG);
    p.dispatchWorkgroups(ceilDiv(kpCount,256)); p.end();
  }

  visualize(mem, canvas){
    // Heatmap density
    const W=mem.W; const H=mem.H;
    canvas.width=W; canvas.height=H;
    const d=this.#device; const q=this.#queue;
    const stage=d.createBuffer({size:W*H*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.densityBuf,0,stage,0,W*H*4);
    q.submit([enc.finish()]);
    stage.mapAsync(GPUMapMode.READ).then(()=>{
      const f=new Float32Array(stage.getMappedRange());
      let mx=0; for(const v of f) mx=Math.max(mx,v);
      const rgba=new Uint8ClampedArray(W*H*4);
      for(let i=0;i<W*H;i++){
        const v=mx>0?f[i]/mx:0;
        // inferno-like colormap
        rgba[i*4  ]=(v*0.9+0.1)*255*(v>0.5?1:v*2)|0;
        rgba[i*4+1]=(v*0.7)*255|0;
        rgba[i*4+2]=(1-v)*200|0;
        rgba[i*4+3]=255;
      }
      stage.unmap(); stage.destroy();
      canvas.getContext('2d').putImageData(new ImageData(rgba,W,H),0,0);
    });
  }
}
