// segmentationStage.js — CCL pipeline
import { makeBinaryThresholdPipeline } from './binaryThreshold.js';
import { makeLocalLabelInitPipeline }  from './localLabelInit.js';
import { makeLabelResolvePipeline }    from './labelResolve.js';
import { makeLabelFlattenPipeline }    from './labelFlatten.js';
import { makeRelabelCompactPipeline }  from './relabelCompact.js';
import { ceilDiv }                     from '../00_common/math.js';
import { blitLabelBufferToCanvas }     from '../../core/dispatch.js';
import { Config }                      from '../../config.js';

export class SegmentationStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [bt,li,lr,lf,rc]=await Promise.all([
      makeBinaryThresholdPipeline(this.#device,loadShader),
      makeLocalLabelInitPipeline(this.#device,loadShader),
      makeLabelResolvePipeline(this.#device,loadShader),
      makeLabelFlattenPipeline(this.#device,loadShader),
      makeRelabelCompactPipeline(this.#device,loadShader),
    ]);
    this.#pls={bt,li,lr,lf,rc};
  }

  encode(enc, mem){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const W=mem.W; const H=mem.H; const N=W*H;
    const wgFlat=ceilDiv(N,256); const wg2=[ceilDiv(W,8),ceilDiv(H,8)];
    const uni=(arr)=>{ const b=d.createBuffer({size:Math.max(arr.byteLength,16),usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(b,0,arr); return b; };

    // 1. Binary threshold
    const btData=new ArrayBuffer(16); new Uint32Array(btData)[0]=N; new Float32Array(btData)[1]=Config.BIN_THRESH;
    const btUni=uni(btData);
    const btBG=d.createBindGroup({layout:this.#pls.bt.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:btUni}},{binding:1,resource:{buffer:mem.confBuf}},{binding:2,resource:{buffer:mem.binaryBuf}},
    ]});
    const p0=enc.beginComputePass({label:'binThresh'});
    p0.setPipeline(this.#pls.bt); p0.setBindGroup(0,btBG); p0.dispatchWorkgroups(wgFlat); p0.end();

    // 2. Init labels
    const liUni=uni(new Uint32Array([N,0,0,0]));
    const liBG=d.createBindGroup({layout:this.#pls.li.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:liUni}},{binding:1,resource:{buffer:mem.binaryBuf}},{binding:2,resource:{buffer:mem.labelBuf}},
    ]});
    const p1=enc.beginComputePass({label:'lblInit'});
    p1.setPipeline(this.#pls.li); p1.setBindGroup(0,liBG); p1.dispatchWorkgroups(wgFlat); p1.end();

    // 3. Iterative resolve
    const lrUni=uni(new Uint32Array([W,H,0,0]));
    const lrBG=d.createBindGroup({layout:this.#pls.lr.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:lrUni}},{binding:1,resource:{buffer:mem.labelBuf}},{binding:2,resource:{buffer:mem.changedBuf}},
    ]});
    for(let i=0;i<Config.LABEL_ITERS_SEG;i++){
      const p=enc.beginComputePass({label:`lblResolve_${i}`});
      p.setPipeline(this.#pls.lr); p.setBindGroup(0,lrBG); p.dispatchWorkgroups(wg2[0],wg2[1]); p.end();
    }

    // 4. Flatten
    const lfUni=uni(new Uint32Array([N,0,0,0]));
    const lfBG=d.createBindGroup({layout:this.#pls.lf.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:lfUni}},{binding:1,resource:{buffer:mem.labelBuf}},
    ]});
    const p4=enc.beginComputePass({label:'lblFlatten'});
    p4.setPipeline(this.#pls.lf); p4.setBindGroup(0,lfBG); p4.dispatchWorkgroups(wgFlat); p4.end();

    // 5. Compact
    q.writeBuffer(mem.segCtr,0,new Uint32Array([0]));
    q.writeBuffer(mem.remapBuf,0,new Uint32Array(Config.MAX_LABELS));
    const rcUni=uni(new Uint32Array([N,Config.MAX_LABELS,0,0]));
    const rcBG=d.createBindGroup({layout:this.#pls.rc.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:rcUni}},{binding:1,resource:{buffer:mem.labelBuf}},
      {binding:2,resource:{buffer:mem.remapBuf}},{binding:3,resource:{buffer:mem.segCtr}},
      {binding:4,resource:{buffer:mem.relabelBuf}},
    ]});
    const p5=enc.beginComputePass({label:'relabelCompact'});
    p5.setPipeline(this.#pls.rc); p5.setBindGroup(0,rcBG); p5.dispatchWorkgroups(wgFlat); p5.end();
  }

  visualize(mem, canvas){
    blitLabelBufferToCanvas(this.#device, this.#queue, mem.relabelBuf, mem.W, mem.H, canvas);
  }
}
