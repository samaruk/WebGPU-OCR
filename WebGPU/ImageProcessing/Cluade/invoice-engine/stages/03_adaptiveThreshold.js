// stages/03_adaptiveThreshold.js

import { cdiv, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/threshold.wgsl?raw';
import { CONFIG } from '../config.js';
const SHADER = await loadShader('../invoice-engine/shaders/threshold.wgsl?raw');

export async function adaptiveThreshold(ctx, bm, pm, w, h) {
  const src = bm.getTexture('gray');
  const dst = bm.createTexture('threshold', w, h, 'rgba8unorm');

  const pipeline = await pm.computePipeline('threshold', SHADER);

  const { blockSize, C } = CONFIG.threshold;
  const paramsBuf = ctx.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Params: width, height, block_half, C
  ctx.device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([w, h, Math.floor(blockSize / 2), 0]));
  ctx.device.queue.writeBuffer(paramsBuf, 12, new Float32Array([C]));

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
