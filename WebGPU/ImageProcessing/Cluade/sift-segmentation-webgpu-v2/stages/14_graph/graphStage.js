// graphStage.js — build adjacency graph, score + merge components
import { makeAdjacencyBuildPipeline } from './adjacencyBuild.js';
import { makeMergeScorePipeline }     from './mergeScore.js';
import { makeSplitScorePipeline }     from './splitScore.js';
import { makeDetermMergePipeline }    from './deterministicMerge.js';
import { ceilDiv }                    from '../00_common/math.js';
import { blitLabelBufferToCanvas }    from '../../core/dispatch.js';
import { Config }                     from '../../config.js';

export class GraphStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const [ab,ms,ss,dm]=await Promise.all([
      makeAdjacencyBuildPipeline(this.#device,loadShader),
      makeMergeScorePipeline(this.#device,loadShader),
      makeSplitScorePipeline(this.#device,loadShader),
      makeDetermMergePipeline(this.#device,loadShader),
    ]);
    this.#pls={ab,ms,ss,dm};
  }

  encode(enc, mem, edgeCount=1000){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const W=mem.W; const H=mem.H;
    const wg2=[ceilDiv(W,8),ceilDiv(H,8)]; const wgE=ceilDiv(edgeCount,256);

    q.writeBuffer(mem.graphEdgeCtr,0,new Uint32Array([0]));

    const abUni=d.createBuffer({size:16,usage:U.UNIFORM|U.COPY_DST});
    q.writeBuffer(abUni,0,new Uint32Array([W,H,Config.MAX_EDGES,0]));
    const abBG=d.createBindGroup({layout:this.#pls.ab.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:abUni}},{binding:1,resource:{buffer:mem.relabelBuf}},
      {binding:2,resource:{buffer:mem.graphEdgeCtr}},{binding:3,resource:{buffer:mem.graphEdgeBuf}},
    ]});
    const p0=enc.beginComputePass({label:'adjBuild'}); p0.setPipeline(this.#pls.ab); p0.setBindGroup(0,abBG); p0.dispatchWorkgroups(wg2[0],wg2[1]); p0.end();

    // Score: placeholder (mergeScores not fully wired without shared boundary buf)
    const dmData=new ArrayBuffer(16); new Uint32Array(dmData)[0]=edgeCount; new Float32Array(dmData)[1]=Config.MERGE_THRESH;
    const dmUni=d.createBuffer({size:16,usage:U.UNIFORM|U.COPY_DST}); q.writeBuffer(dmUni,0,dmData);
    // Use mergeScoreBuf as a uniform score (all 1s)
    const dmBG=d.createBindGroup({layout:this.#pls.dm.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:dmUni}},{binding:1,resource:{buffer:mem.graphEdgeBuf}},
      {binding:2,resource:{buffer:mem.mergeScoreBuf}},{binding:3,resource:{buffer:mem.relabelBuf}},
      {binding:4,resource:{buffer:mem.changedBuf}},
    ]});
    for(let i=0;i<Config.GRAPH_ITERS;i++){
      const p=enc.beginComputePass({label:`merge_${i}`}); p.setPipeline(this.#pls.dm); p.setBindGroup(0,dmBG); p.dispatchWorkgroups(wgE); p.end();
    }
  }

  visualize(mem, canvas){
    blitLabelBufferToCanvas(this.#device, this.#queue, mem.relabelBuf, mem.W, mem.H, canvas);
  }
}
