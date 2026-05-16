import { createConfidencePipeline }  from './confidenceMap/confidencePipeline.js';
import { encodeConfidencePass }       from './confidenceMap/confidencePass.js';
import { createMorphOpenPipeline }   from './morphOpen/morphOpenPipeline.js';
import { encodeMorphOpenPass }        from './morphOpen/morphOpenPass.js';
import { createResegmentPipeline }   from './resegment/resegmentPipeline.js';
import { encodeResegmentPass }        from './resegment/resegmentPass.js';
import { CONFIG } from '../../config.js';

export class ResegmentStage {
  constructor(device, texMgr, bufMgr) {
    this.device=device; this.texMgr=texMgr; this.bufMgr=bufMgr;
    this.pipelines={}; this.textures={};
  }
  async init() {
    this.pipelines.conf     = await createConfidencePipeline(this.device);
    this.pipelines.morph    = await createMorphOpenPipeline(this.device);
    this.pipelines.resegment= await createResegmentPipeline(this.device);
  }
  run(encoder, swtTex, binaryTex, width, height) {
    if (!this.textures.conf) {
      this.textures.conf   = this.texMgr.rgba(width, height, 'conf-out');
      this.textures.clean  = this.texMgr.rgba(width, height, 'morph-tmp');
      this.textures.opened = this.texMgr.rgba(width, height, 'morph-out');
      this.textures.output = this.texMgr.rgba(width, height, 'reseg-out');
    }
    // 1. Confidence map (touch detection via SWT stroke width variance)
    encodeConfidencePass(this.device, encoder, this.pipelines.conf,
        swtTex, binaryTex, this.textures.conf,
        width, height, CONFIG.resegment.confidenceThreshold);

    // 2. Morphological opening: removes isolated noise dots smaller than radius px
    //    radius=2 removes 1-3px specks; larger = more aggressive
    encodeMorphOpenPass(this.device, encoder, this.pipelines.morph,
        binaryTex, this.textures.clean, this.textures.opened,
        width, height, CONFIG.resegment.noiseRadius ?? 2,
        CONFIG.resegment.minNeighbours ?? 4);

    // 3. Final output: clean binary + confidence overlay
    encodeResegmentPass(this.device, encoder, this.pipelines.resegment,
        this.textures.conf, this.textures.opened, this.textures.output,
        width, height);

    return this.textures.output;
  }
}
