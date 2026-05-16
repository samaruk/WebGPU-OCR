// stages/06_distanceFinalize.js — Convert JFA seed map → float distance field

import { cdiv, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/localmax.wgsl?raw';
const SHADER = await loadShader('../invoice-engine/shaders/localmax.wgsl?raw');

export async function distanceFinalize(ctx, bm, pm, w, h, pingpong, finalIdx) {
  const seedTex = pingpong[finalIdx];
  const distTex = bm.createTexture('distance', w, h, 'r32float',
    GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

  const pipeline = await pm.computePipeline('distance_finalize', SHADER);

  const paramsBuf = ctx.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  ctx.device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([w, h, 5, 0]));
  ctx.device.queue.writeBuffer(paramsBuf, 16, new Float32Array([4, Math.min(w, h) * 0.15, 0.45, 0]));

  const bg = ctx.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: seedTex.createView() },
      { binding: 1, resource: distTex.createView() },
      { binding: 2, resource: { buffer: paramsBuf } },
    ],
  });

  const enc = ctx.device.createCommandEncoder();
  pm.dispatch(enc, pipeline, bg, cdiv(w, 16), cdiv(h, 16));
  ctx.device.queue.submit([enc.finish()]);
  await ctx.device.queue.onSubmittedWorkDone();
  paramsBuf.destroy();
}
