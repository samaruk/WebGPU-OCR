// stages/09_morphologyVertical.js

import { cdiv, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/morph_vertical.wgsl?raw';
import { CONFIG } from '../config.js';
const SHADER = await loadShader('../invoice-engine/shaders/morph_vertical.wgsl?raw');

export async function morphologyVertical(ctx, bm, pm, w, h) {
  const src = bm.getTexture('morph_h');
  const dst = bm.createTexture('morph_v', w, h, 'rgba8unorm');

  const pipeline = await pm.computePipeline('morph_v', SHADER);
  const kh = Math.floor(CONFIG.morphology.verticalKernel / 2);

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
