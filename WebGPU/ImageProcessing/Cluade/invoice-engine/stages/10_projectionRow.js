// stages/10_projectionRow.js

import { cdiv, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/projection_row.wgsl?raw';
const SHADER = await loadShader('../invoice-engine/shaders/projection_row.wgsl?raw');

export async function projectionRow(ctx, bm, pm, w, h) {
  const morph = bm.getTexture('morph_v');

  const rowBuf = ctx.device.createBuffer({
    size: h * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  bm.setBuffer('row_sums', rowBuf);

  const pipeline = await pm.computePipeline('proj_row', SHADER);

  const paramsBuf = ctx.device.createBuffer({
    size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  ctx.device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([w, h]));

  const bg = ctx.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: morph.createView() },
      { binding: 1, resource: { buffer: rowBuf } },
      { binding: 2, resource: { buffer: paramsBuf } },
    ],
  });

  const enc = ctx.device.createCommandEncoder();
  pm.dispatch(enc, pipeline, bg, cdiv(h, 256));
  ctx.device.queue.submit([enc.finish()]);
  await ctx.device.queue.onSubmittedWorkDone();
  paramsBuf.destroy();
}
