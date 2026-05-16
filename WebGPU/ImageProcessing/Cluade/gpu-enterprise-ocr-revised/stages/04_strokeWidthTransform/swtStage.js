import { createGradientPipeline }    from './gradient/gradientPipeline.js';
import { encodeGradientPass }         from './gradient/gradientPass.js';
import { createSWTRaytracePipeline } from './rayTrace/swtRaytracePipeline.js';
import { encodeSWTRaytracePass }      from './rayTrace/swtRaytracePass.js';
import { createSWTMedianPipeline }   from './swtMedian/swtMedianPipeline.js';
import { encodeSWTMedianPass }        from './swtMedian/swtMedianPass.js';
import { CONFIG } from '../../config.js';

export class SWTStage {
  constructor(device, texMgr, bufMgr) {
    this.device=device; this.texMgr=texMgr; this.bufMgr=bufMgr;
    this.pipelines={}; this.textures={}; this.buffers={};
  }
  async init() {
    this.pipelines.gradient = await createGradientPipeline(this.device);
    this.pipelines.raytrace = await createSWTRaytracePipeline(this.device);  // {clear, raytrace}
    this.pipelines.median   = await createSWTMedianPipeline(this.device);
  }
  run(encoder, binaryTex, width, height) {
    const N = width * height;
    if (!this.textures.output) {
      this.buffers.grad   = this.bufMgr.storage(N*4*2, false, 'swt-grad');
      this.buffers.swt    = this.bufMgr.storage(N*4,   true,  'swt-buf');
      this.textures.output = this.texMgr.rgba(width, height, 'swt-out');
    }
    encodeGradientPass(this.device, encoder, this.pipelines.gradient,
        binaryTex, this.buffers.grad, width, height);
    // Pass pipelines.raytrace object (has .clear and .raytrace sub-pipelines)
    encodeSWTRaytracePass(this.device, encoder, this.pipelines.raytrace,
        binaryTex, this.buffers.grad, this.buffers.swt,
        width, height, CONFIG.swt.maxStrokeWidth);
    encodeSWTMedianPass(this.device, encoder, this.pipelines.median,
        this.buffers.swt, this.textures.output,
        width, height, CONFIG.swt.maxStrokeWidth);
    return this.textures.output;
  }
}
