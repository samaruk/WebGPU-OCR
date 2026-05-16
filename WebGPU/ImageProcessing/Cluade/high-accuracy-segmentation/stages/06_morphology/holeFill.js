/**
 * stages/06_morphology/holeFill.js
 * Fills broken loops in characters like O, D, 0, 8.
 * Uses flood-fill from image border (background-seeded) and inverts.
 * stageGated — enabled when holeFill flag is true in stageGating.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/06_morphology/holeFill.wgsl');

export async function runHoleFill(gpuCtx, binaryTex, params, registry) {
  const { device } = gpuCtx;
  const W = binaryTex.width, H = binaryTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "holefill_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("holeFill", WGSL);

  const uData = new Float32Array([W, H, 0, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bindGroup = builder.buildBindGroup(pipeline, [
    binaryTex.createView(), outTex.createView(), { buffer: uBuf },
  ]);
  // Multiple iterations for flood fill convergence
  const encoder = device.createCommandEncoder();
  for (let i = 0; i < 50; i++) {
    dispatch2D(encoder, pipeline, bindGroup, W, H);
  }
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
