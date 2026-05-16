// stages/11_projectionColumn.js

import { cdiv, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/projection_column.wgsl?raw';
const SHADER = await loadShader('../invoice-engine/shaders/projection_column.wgsl?raw');

export async function projectionColumn(ctx, bm, pm, w, h) {
  const morph = bm.getTexture('morph_v');

  const colBuf = ctx.device.createBuffer({
    size: w * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  bm.setBuffer('col_sums', colBuf);

  const pipeline = await pm.computePipeline('proj_col', SHADER);

  const paramsBuf = ctx.device.createBuffer({
    size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  ctx.device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([w, h]));

  const bg = ctx.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: morph.createView() },
      { binding: 1, resource: { buffer: colBuf } },
      { binding: 2, resource: { buffer: paramsBuf } },
    ],
  });

  const enc = ctx.device.createCommandEncoder();
  pm.dispatch(enc, pipeline, bg, cdiv(w, 256));
  ctx.device.queue.submit([enc.finish()]);
  await ctx.device.queue.onSubmittedWorkDone();
  paramsBuf.destroy();
}
