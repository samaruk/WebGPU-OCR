/**
 * Detects skeleton endpoints (pixels with exactly one skeleton neighbor).
 */
import { PipelineBuilder } from "../../../core/pipelineBuilder.js";
import { dispatch2D } from "../../../core/dispatch.js";
import { loadShader } from "../../../core/loadShader.js";
const WGSL = await loadShader('./stages/15_graphMerge_phase2/endpoints/endpointMap.wgsl');

export async function runEndpointMap(gpuCtx, skeletonTex, registry) {
  const { device } = gpuCtx;
  const W = skeletonTex.width, H = skeletonTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "endpoints");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("endpointMap", WGSL);
  const uData = new Float32Array([W, H, 0, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);
  const bg  = builder.buildBindGroup(pipeline, [skeletonTex.createView(), outTex.createView(), { buffer: uBuf }]);
  const enc = device.createCommandEncoder();
  dispatch2D(enc, pipeline, bg, W, H);
  await gpuCtx.submit(enc);
  uBuf.destroy();
  return outTex;
}
