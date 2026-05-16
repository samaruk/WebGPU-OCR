/**
 * stages/04_lineRemoval/widthGateFilter.js
 * Prevents removal of strokes that are within text stroke width range.
 * Lines wider than widthGateFactor * meanStrokeWidth are "too thick to be text lines"
 * and are removed. Lines thinner than that are preserved as potential text.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/04_lineRemoval/widthGateFilter.wgsl');

export async function runWidthGateFilter(gpuCtx, originalTex, processedTex, params, registry) {
  // If we don't yet have SWT data (pre-SWT stage), use DPI-based estimate
  const estimatedStroke = params.sauvolaWindowBootstrap / 3.0;
  const gateWidth = estimatedStroke * params.houghWidthGateFactor;

  const { device } = gpuCtx;
  const W = originalTex.width, H = originalTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "widthgate_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("widthGateFilter", WGSL);

  const uData = new Float32Array([W, H, gateWidth, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bindGroup = builder.buildBindGroup(pipeline, [
    originalTex.createView(), processedTex.createView(), outTex.createView(), { buffer: uBuf },
  ]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
