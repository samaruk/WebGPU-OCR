
import { createThinningPipeline }     from './thinning/thinningPipeline.js';
import { encodeThinningPass }          from './thinning/thinningPass.js';
import { createSkeletonGraphPipeline } from './skeletonGraph/skeletonGraphPipeline.js';
import { encodeSkeletonGraphPass }     from './skeletonGraph/skeletonGraphPass.js';
import { createJunctionPipeline }      from './junctionDetect/junctionPipeline.js';
import { encodeJunctionPass }          from './junctionDetect/junctionPass.js';
import { CONFIG } from '../../config.js';

export class SkeletonStage {
  constructor(device,texMgr,bufMgr){
    this.device=device;this.texMgr=texMgr;this.bufMgr=bufMgr;
    this.pipelines={};this.textures={};this.buffers={};
    // FIX: _initPipeline created here (set to null) – compiled once in init()
    this._initPipeline=null;
  }

  async init(){
    this.pipelines.thin    =await createThinningPipeline(this.device);
    this.pipelines.graph   =await createSkeletonGraphPipeline(this.device);
    this.pipelines.junction=await createJunctionPipeline(this.device);

    // FIX: compile _initPipeline ONCE here, not per-run
    const code=`
@group(0)@binding(0) var binaryTex:texture_2d<f32>;
@group(0)@binding(1) var<storage,read_write> out:array<u32>;
@group(0)@binding(2) var<uniform> u:vec4<u32>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  if(gid.x>=u.x||gid.y>=u.y){return;}
  let v=textureLoad(binaryTex,vec2<i32>(gid.xy),0).r;
  out[gid.y*u.x+gid.x]=select(0u,1u,v>0.5);
}`;
    const mod=this.device.createShaderModule({code,label:'skelInit'});
    this._initPipeline=this.device.createComputePipeline({
      layout:'auto',compute:{module:mod,entryPoint:'main'},label:'skelInitPipeline',
    });
  }

  run(encoder, binaryTex, width, height) {
    const N=width*height;
    if(!this.textures.graph){
      this.buffers.A      =this.bufMgr.storage(N*4,true,'skel-A');
      this.buffers.B      =this.bufMgr.storage(N*4,true,'skel-B');
      this.buffers.changed=this.bufMgr.atomicStorage(4,'skel-changed');
      this.textures.graph =this.texMgr.rgba(width,height,'skel-graph');
      this.textures.output=this.texMgr.rgba(width,height,'skel-out');
    }

    // Init buffer from texture using pre-compiled pipeline
    {
      const uni=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      this.device.queue.writeBuffer(uni,0,new Uint32Array([width,height,0,0]));
      const bg=this.device.createBindGroup({layout:this._initPipeline.getBindGroupLayout(0),entries:[
        {binding:0,resource:binaryTex.createView()},
        {binding:1,resource:{buffer:this.buffers.A}},
        {binding:2,resource:{buffer:uni}},
      ]});
      const p=encoder.beginComputePass({label:'skelInit'});
      p.setPipeline(this._initPipeline);p.setBindGroup(0,bg);
      p.dispatchWorkgroups(Math.ceil(width/16),Math.ceil(height/16));p.end();
    }

    let cur=this.buffers.A,nxt=this.buffers.B;
    for(let i=0;i<CONFIG.skeleton.thinningIterations;i++){
      for(const sub of[0,1]){
        encodeThinningPass(this.device,encoder,this.pipelines.thin,
            cur,nxt,this.buffers.changed,width,height,sub);
        encoder.copyBufferToBuffer(nxt,0,cur,0,N*4);
      }
    }
    encodeSkeletonGraphPass(this.device,encoder,this.pipelines.graph,
        cur,this.textures.graph,width,height);
    encodeJunctionPass(this.device,encoder,this.pipelines.junction,
        cur,this.textures.graph,this.textures.output,width,height);
    return this.textures.output;
  }
}
