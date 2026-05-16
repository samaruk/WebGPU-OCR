
import { createSobelPipeline } from './sobel/sobelPipeline.js';
import { encodeSobelPass }     from './sobel/sobelPass.js';
export class SobelStage{
  constructor(device,texMgr){this.device=device;this.texMgr=texMgr;this.pipeline=null;this.outputTex=null;}
  async init(){this.pipeline=await createSobelPipeline(this.device);}
  run(encoder,inputTex,width,height){
    if(!this.outputTex) this.outputTex=this.texMgr.rgba(width,height,'sobel-out');
    encodeSobelPass(this.device,encoder,this.pipeline,inputTex,this.outputTex,width,height);
    return this.outputTex;
  }
}
