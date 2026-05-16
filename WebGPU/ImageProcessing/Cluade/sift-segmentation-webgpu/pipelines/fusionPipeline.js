// pipelines/fusionPipeline.js
import { ceilDiv } from '../core/barrierUtils.js';
import { Config }  from '../config.js';

export class FusionPipeline {
  #gpu; #cache; #shaders = {};
  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    for (const n of ['adaptiveMaskFusion','confidenceScore'])
      this.#shaders[n] = await loadShader(`fusion/${n}.wgsl`);
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`fusion/${k}`, s);
  }

  encode(enc, bufs, pixelCount) {
    const d   = this.#gpu.device;
    const wg  = ceilDiv(pixelCount, Config.WG.FLAT_256);
    const fusePL = this.#cache.get('fusion/adaptiveMaskFusion');
    const confPL = this.#cache.get('fusion/confidenceScore');

    const fuseBG = d.createBindGroup({
      layout: fusePL.getBindGroupLayout(0),
      entries:[
        {binding:0,resource:{buffer:bufs.fuseUniform}},
        {binding:1,resource:{buffer:bufs.density}},
        {binding:2,resource:{buffer:bufs.consist}},
        {binding:3,resource:{buffer:bufs.mask}},
      ],
    });
    const fp = enc.beginComputePass({label:'maskFusion'});
    fp.setPipeline(fusePL); fp.setBindGroup(0,fuseBG);
    fp.dispatchWorkgroups(wg); fp.end();

    const confBG = d.createBindGroup({
      layout: confPL.getBindGroupLayout(0),
      entries:[
        {binding:0,resource:{buffer:bufs.confUniform}},
        {binding:1,resource:{buffer:bufs.mask}},
        {binding:2,resource:{buffer:bufs.density}},
        {binding:3,resource:{buffer:bufs.conf}},
        {binding:4,resource:{buffer:bufs.binary}},
      ],
    });
    const cp = enc.beginComputePass({label:'confidence'});
    cp.setPipeline(confPL); cp.setBindGroup(0,confBG);
    cp.dispatchWorkgroups(wg); cp.end();
  }
}
