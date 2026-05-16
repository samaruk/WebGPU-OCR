// fusionStage.js
import { makeAdaptiveMaskFusionPipeline } from './adaptiveMaskFusion.js';
import { makeConfidenceScorePipeline }    from './confidenceScore.js';
import { ceilDiv }                        from '../00_common/math.js';
import { blitBufferToCanvas }             from '../../core/dispatch.js';
import { Config }                         from '../../config.js';

export class FusionStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [mf,cs]=await Promise.all([
      makeAdaptiveMaskFusionPipeline(this.#device,loadShader),
      makeConfidenceScorePipeline(this.#device,loadShader),
    ]);
    this.#pls={mf,cs};
  }

  encode(enc, mem){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const N=mem.W*mem.H; const wg=ceilDiv(N,256);

    const uni=(arr)=>{ const b=d.createBuffer({size:Math.max(arr.byteLength,16),usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(b,0,arr); return b; };

    // Normalise density (max=1)
    const mfData=new ArrayBuffer(16); new Uint32Array(mfData)[0]=N; new Float32Array(mfData)[1]=Config.FUSION_ALPHA;
    const mfUni=uni(mfData);
    const mfBG=d.createBindGroup({layout:this.#pls.mf.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:mfUni}},
      {binding:1,resource:{buffer:mem.densityBuf}},
      {binding:2,resource:{buffer:mem.consistBuf}},
      {binding:3,resource:{buffer:mem.maskBuf}},
    ]});
    const p0=enc.beginComputePass({label:'maskFusion'});
    p0.setPipeline(this.#pls.mf); p0.setBindGroup(0,mfBG);
    p0.dispatchWorkgroups(wg); p0.end();

    const csData=new ArrayBuffer(16); new Uint32Array(csData)[0]=N; new Float32Array(csData)[1]=Config.CONF_THRESH;
    const csUni=uni(csData);
    const csBG=d.createBindGroup({layout:this.#pls.cs.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:csUni}},
      {binding:1,resource:{buffer:mem.maskBuf}},
      {binding:2,resource:{buffer:mem.densityBuf}},
      {binding:3,resource:{buffer:mem.confBuf}},
      {binding:4,resource:{buffer:mem.binaryBuf}},
    ]});
    const p1=enc.beginComputePass({label:'confScore'});
    p1.setPipeline(this.#pls.cs); p1.setBindGroup(0,csBG);
    p1.dispatchWorkgroups(wg); p1.end();
  }

  visualize(mem, canvas){
    blitBufferToCanvas(this.#device, this.#queue, mem.confBuf, mem.W, mem.H, canvas);
  }
}
