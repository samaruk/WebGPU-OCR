/**
 * stages/10_markerExtraction/regionalMaxima.js
 * Detects regional maxima in the h-suppressed distance map.
 * A regional maximum is a connected set of pixels with the same value
 * where all neighbors have strictly lower values.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/10_markerExtraction/regionalMaxima.wgsl');

export async function runRegionalMaxima(gpuCtx, distTex, registry) {
  const { device } = gpuCtx;
  const W = distTex.width, H = distTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "reg_maxima");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("regionalMaxima", WGSL);

  const uData = new Float32Array([W, H, 0, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bg = builder.buildBindGroup(pipeline, [distTex.createView(), outTex.createView(), { buffer: uBuf }]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bg, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
