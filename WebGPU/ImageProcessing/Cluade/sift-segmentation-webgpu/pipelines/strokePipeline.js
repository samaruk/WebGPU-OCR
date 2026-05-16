// pipelines/strokePipeline.js
import { ceilDiv } from '../core/barrierUtils.js';
import { Config }  from '../config.js';

export class StrokePipeline {
  #gpu; #cache; #shaders = {};
  constructor(gpuCtx, cache) { this.#gpu=gpuCtx; this.#cache=cache; }

  async loadShaders(loadShader) {
    for (const n of ['gradientMagnitude','rayCastStrokeWidth','strokeMedianReduce','strokeConsistencyMap'])
      this.#shaders[n] = await loadShader(`stroke/${n}.wgsl`);
  }

  async init() {
    for (const [k,s] of Object.entries(this.#shaders))
      await this.#cache.get(`stroke/${k}`, s);
  }

  encode(enc, bufs, W, H) {
    const d  = this.#gpu.device;
    const wg = ceilDiv(W * H, Config.WG.FLAT_256);

    const gradPL = this.#cache.get('stroke/gradientMagnitude');
    const rayPL  = this.#cache.get('stroke/rayCastStrokeWidth');

    const gradBG = d.createBindGroup({
      layout: gradPL.getBindGroupLayout(0),
      entries:[
        {binding:0,resource:{buffer:bufs.gradUniform}},
        {binding:1,resource:{buffer:bufs.gray}},
        {binding:2,resource:{buffer:bufs.mag}},
        {binding:3,resource:{buffer:bufs.ang}},
      ],
    });
    const gp = enc.beginComputePass({label:'gradMag'});
    gp.setPipeline(gradPL); gp.setBindGroup(0,gradBG);
    gp.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); gp.end();

    const rayBG = d.createBindGroup({
      layout: rayPL.getBindGroupLayout(0),
      entries:[
        {binding:0,resource:{buffer:bufs.rayUniform}},
        {binding:1,resource:{buffer:bufs.mag}},
        {binding:2,resource:{buffer:bufs.ang}},
        {binding:3,resource:{buffer:bufs.swt}},
      ],
    });
    const rp = enc.beginComputePass({label:'rayCastSWT'});
    rp.setPipeline(rayPL); rp.setBindGroup(0,rayBG);
    rp.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); rp.end();
  }
}
