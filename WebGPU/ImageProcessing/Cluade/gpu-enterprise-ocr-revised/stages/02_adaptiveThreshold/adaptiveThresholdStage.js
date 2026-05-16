import { createIntegralPipelines }         from './integralImage/integralPipeline.js';
import { encodeIntegralPass }               from './integralImage/integralPass.js';
import { createAdaptiveThresholdPipeline }  from './adaptiveThreshold/adaptiveThresholdPipeline.js';
import { encodeAdaptiveThresholdPass }      from './adaptiveThreshold/adaptiveThresholdPass.js';
import { CONFIG } from '../../config.js';

export class AdaptiveThresholdStage {
  constructor(device, texMgr, bufMgr) {
    this.device=device; this.texMgr=texMgr; this.bufMgr=bufMgr;
    this.pipelines={}; this.textures={}; this.buffers={};
  }
  async init() {
    this.pipelines.integral  = await createIntegralPipelines(this.device);
    this.pipelines.threshold = await createAdaptiveThresholdPipeline(this.device);
  }
  run(encoder, inputTex, width, height) {
    const N = width * height;
    if (!this.textures.output) {
      // Storage buffers for integral image intermediates (no float texture issues)
      this.buffers.row    = this.bufMgr.storage(N * 4, false, 'integral-row');
      this.buffers.col    = this.bufMgr.storage(N * 4, false, 'integral-col');
      this.textures.output = this.texMgr.rgba(width, height, 'adaptive-out');
    }
    encodeIntegralPass(this.device, encoder, this.pipelines.integral,
      inputTex, this.buffers.row, this.buffers.col, width, height);
    encodeAdaptiveThresholdPass(this.device, encoder, this.pipelines.threshold,
      inputTex, this.buffers.col, this.textures.output,
      width, height, CONFIG.adaptiveThreshold.blockRadius, CONFIG.adaptiveThreshold.C);
    return this.textures.output;
  }
}
