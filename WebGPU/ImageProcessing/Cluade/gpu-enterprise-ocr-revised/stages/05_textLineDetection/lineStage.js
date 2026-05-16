
import { createProjectionHPipeline } from './horizontalProjection/projectionHPipeline.js';
import { encodeProjectionHPass }      from './horizontalProjection/projectionHPass.js';
import { createValleyPipeline }       from './lineValleyDetect/valleyPipeline.js';
import { encodeValleyPass }           from './lineValleyDetect/valleyPass.js';
import { CONFIG } from '../../config.js';
export class LineStage{
  constructor(device,texMgr,bufMgr){this.device=device;this.texMgr=texMgr;this.bufMgr=bufMgr;
    this.pipelines={};this.textures={};this.buffers={};}
  async init(){
    this.pipelines.projH =await createProjectionHPipeline(this.device);
    this.pipelines.valley=await createValleyPipeline(this.device);
  }
  run(encoder,binaryTex,width,height){
    if(!this.textures.output){
      this.textures.output=this.texMgr.rgba(width,height,'lines-out');
      this.buffers.proj   =this.bufMgr.storage(height*4,true,'proj-h');
      this.buffers.valley =this.bufMgr.storage(height*4,false,'valley-mask');
    }
    encodeProjectionHPass(this.device,encoder,this.pipelines.projH,
        binaryTex,this.buffers.proj,width,height);
    encodeValleyPass(this.device,encoder,this.pipelines.valley,
        this.buffers.proj,this.buffers.valley,this.textures.output,
        width,height,CONFIG.textLine.valleyThreshold);
    return this.textures.output;
  }
}
