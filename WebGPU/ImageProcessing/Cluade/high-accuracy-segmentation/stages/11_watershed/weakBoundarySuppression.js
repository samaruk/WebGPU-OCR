/**
 * stages/11_watershed/weakBoundarySuppression.js
 * Removes watershed boundary lines where gradient is below threshold.
 * Weak boundaries (low contrast) are likely noise-induced splits.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/11_watershed/weakBoundarySuppression.wgsl');

export async function runWeakBoundary(gpuCtx, labelTex, grayTex, params, registry) {
  const { device } = gpuCtx;
  const W = labelTex.width, H = labelTex.height;
  const outTex = registry.createTexture(W, H, "r32uint", "weakboundary_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("weakBoundary", WGSL);

  const uData = new Float32Array([W, H, params.weakBoundaryGradientMin, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bg = builder.buildBindGroup(pipeline, [
    labelTex.createView(), grayTex.createView(), outTex.createView(), { buffer: uBuf },
  ]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bg, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
