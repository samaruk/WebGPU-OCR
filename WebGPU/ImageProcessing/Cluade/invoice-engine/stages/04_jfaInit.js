// stages/04_jfaInit.js

import { cdiv, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/jfa_init.wgsl?raw';
const SHADER = await loadShader('../invoice-engine/shaders/jfa_init.wgsl?raw');

export async function jfaInit(ctx, bm, pm, w, h) {
  const threshold = bm.getTexture('threshold');

  // Create ping-pong textures (rgba16uint)
  const pingpong = [
    bm.createTexture('jfa_ping', w, h, 'rgba16uint'),
    bm.createTexture('jfa_pong', w, h, 'rgba16uint'),
  ];

  const pipeline = await pm.computePipeline('jfa_init', SHADER);

  const paramsBuf = ctx.device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  ctx.device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([w, h]));

  const bg = ctx.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: threshold.createView() },
      { binding: 1, resource: pingpong[0].createView() },
      { binding: 2, resource: { buffer: paramsBuf } },
    ],
  });

  const enc = ctx.device.createCommandEncoder();
  pm.dispatch(enc, pipeline, bg, cdiv(w, 16), cdiv(h, 16));
  ctx.device.queue.submit([enc.finish()]);
  await ctx.device.queue.onSubmittedWorkDone();
  paramsBuf.destroy();

  return pingpong;  // pingpong[0] is now seeded
}
