/**
 * stages/15_graphMerge_phase2/skeleton/skeletonize.js
 * Medial axis skeletonization via iterative thinning (Zhang-Suen algorithm).
 */
import { PipelineBuilder } from "../../../core/pipelineBuilder.js";
import { dispatch2D } from "../../../core/dispatch.js";
import { loadShader } from "../../../core/loadShader.js";
const WGSL = await loadShader('./stages/15_graphMerge_phase2/skeleton/skeletonize.wgsl');

export async function runSkeletonize(gpuCtx, binaryTex, registry) {
  const { device } = gpuCtx;
  const W = binaryTex.width, H = binaryTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "skeleton");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("skeletonize", WGSL);

  const uData = new Float32Array([W, H, 0, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  let current = binaryTex;
  for (let iter = 0; iter < 100; iter++) {
    const bg = builder.buildBindGroup(pipeline, [current.createView(), outTex.createView(), { buffer: uBuf }]);
    const enc = device.createCommandEncoder();
    dispatch2D(enc, pipeline, bg, W, H);
    await gpuCtx.submit(enc);
    current = outTex;
  }
  uBuf.destroy();
  return outTex;
}
