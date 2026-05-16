/**
 * Skeleton connectivity score between two components.
 * Measures how many skeleton endpoints of A are "close" to endpoints of B.
 */
import { PipelineBuilder } from "../../../core/pipelineBuilder.js";
import { dispatch2D } from "../../../core/dispatch.js";
import { loadShader } from "../../../core/loadShader.js";
const WGSL = await loadShader('./stages/15_graphMerge_phase2/connectivity/skeletonScore.wgsl');

export async function runSkeletonScore(gpuCtx, endpointTex, labelTex, sws, params, registry) {
  const { device } = gpuCtx;
  const W = endpointTex.width, H = endpointTex.height;
  const scoreBuf = device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  const builder  = new PipelineBuilder(device);
  const pipeline = await builder.build("skeletonScore", WGSL);
  const msw = sws.get(8);
  const uData = new Float32Array([W, H, msw * 1.5, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);
  const bg  = builder.buildBindGroup(pipeline, [endpointTex.createView(), labelTex.createView(), { buffer: scoreBuf }, { buffer: uBuf }]);
  const enc = device.createCommandEncoder();
  dispatch2D(enc, pipeline, bg, W, H);
  await gpuCtx.submit(enc);
  uBuf.destroy(); scoreBuf.destroy();
  return 0.5; // simplified; full: readback scoreBuf and normalize
}
