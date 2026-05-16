// stages/08_morphologyHorizontal.js

import { cdiv, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/morph_horizontal.wgsl?raw';
import { CONFIG } from '../config.js';
const SHADER = await loadShader('../invoice-engine/shaders/morph_horizontal.wgsl?raw');


export async function morphologyHorizontal(ctx, bm, pm, w, h) {
  const src = bm.getTexture('threshold');
  const dst = bm.createTexture('morph_h', w, h, 'rgba8unorm');

  const pipeline = await pm.computePipeline('morph_h', SHADER);
  const kh = Math.floor(CONFIG.morphology.horizontalKernel / 2);

  const paramsBuf = ctx.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  ctx.device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([w, h, kh, 0]));

  const bg = ctx.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: src.createView() },
      { binding: 1, resource: dst.createView() },
      { binding: 2, resource: { buffer: paramsBuf } },
    ],
  });

  const enc = ctx.device.createCommandEncoder();
  pm.dispatch(enc, pipeline, bg, cdiv(w, 16), cdiv(h, 16));
  ctx.device.queue.submit([enc.finish()]);
  await ctx.device.queue.onSubmittedWorkDone();
  paramsBuf.destroy();
}
