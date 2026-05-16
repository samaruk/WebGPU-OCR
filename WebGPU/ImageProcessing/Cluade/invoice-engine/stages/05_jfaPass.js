// stages/05_jfaPass.js

import { cdiv, nextPow2, loadShader } from '../core/utils.js';
//import SHADER from '../shaders/jfa_pass.wgsl?raw';
const SHADER = await loadShader('../invoice-engine/shaders/jfa_pass.wgsl?raw');

export async function jfaPasses(ctx, bm, pm, w, h, pingpong) {
  const pipeline = await pm.computePipeline('jfa_pass', SHADER);

  const maxDim = Math.max(w, h);
  let step = nextPow2(maxDim) >> 1;
  let src = 0;  // index into pingpong

  while (step >= 1) {
    const srcTex = pingpong[src];
    const dstTex = pingpong[1 - src];

    const paramsBuf = ctx.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    ctx.device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([w, h, step, 0]));

    const bg = ctx.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: srcTex.createView() },
        { binding: 1, resource: dstTex.createView() },
        { binding: 2, resource: { buffer: paramsBuf } },
      ],
    });

    const enc = ctx.device.createCommandEncoder();
    pm.dispatch(enc, pipeline, bg, cdiv(w, 16), cdiv(h, 16));
    ctx.device.queue.submit([enc.finish()]);
    await ctx.device.queue.onSubmittedWorkDone();
    paramsBuf.destroy();

    src = 1 - src;
    step >>= 1;
  }

  // Return index of final result
  return { finalIdx: src };
}
