// stages/02_grayscale.js

import { cdiv, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/grayscale.wgsl?raw';
import { CONFIG } from '../config.js';

const SHADER = await loadShader('../invoice-engine/shaders/grayscale.wgsl?raw');
export async function grayscale(ctx, bm, pm, w, h) {
  const src = bm.getTexture('source');
  const dst = bm.createTexture('gray', w, h, 'rgba8unorm');

  // Sampler for source
  const sampler = ctx.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });

  const pipeline = await pm.computePipeline('grayscale', SHADER);

  const { rWeight, gWeight, bWeight } = CONFIG.grayscale;
  const weightsBuf = ctx.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  ctx.device.queue.writeBuffer(weightsBuf, 0, new Float32Array([rWeight, gWeight, bWeight, 0]));

  const bg = ctx.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: src.createView() },
      { binding: 1, resource: dst.createView() },
      { binding: 2, resource: { buffer: weightsBuf } },
    ],
  });

  const enc = ctx.device.createCommandEncoder();
  pm.dispatch(enc, pipeline, bg, cdiv(w, 16), cdiv(h, 16));
  ctx.device.queue.submit([enc.finish()]);
  await ctx.device.queue.onSubmittedWorkDone();
  weightsBuf.destroy();
}
