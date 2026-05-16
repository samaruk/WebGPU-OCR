
import { createProjectionVPipeline } from './verticalProjection/projectionVPipeline.js';
import { encodeProjectionVPass }      from './verticalProjection/projectionVPass.js';
import { createCutDetectPipeline }   from './cutDetection/cutDetectPipeline.js';
import { encodeCutDetectPass }        from './cutDetection/cutDetectPass.js';
import { CONFIG } from '../../config.js';
export class ProjectionStage{
  constructor(device,texMgr,bufMgr){this.device=device;this.texMgr=texMgr;this.bufMgr=bufMgr;
    this.pipelines={};this.textures={};this.buffers={};}
  async init(){
    this.pipelines.projV=await createProjectionVPipeline(this.device);
    this.pipelines.cut  =await createCutDetectPipeline(this.device);
  }
  run(encoder,binaryTex,width,height){
    if(!this.textures.output){
      this.textures.output=this.texMgr.rgba(width,height,'proj-out');
      this.buffers.proj   =this.bufMgr.storage(width*4,true,'proj-v');
      this.buffers.cuts   =this.bufMgr.storage(width*4,false,'cuts');
    }
    encodeProjectionVPass(this.device,encoder,this.pipelines.projV,binaryTex,this.buffers.proj,width,height);
    encodeCutDetectPass(this.device,encoder,this.pipelines.cut,
        this.buffers.proj,this.buffers.cuts,this.textures.output,width,height,CONFIG.projection.cutThreshold);
    return this.textures.output;
  }
}
