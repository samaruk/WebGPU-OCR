/**
 * stages/10_markerExtraction/peakProminence.js
 * Filters regional maxima by peak prominence.
 * Prominence = distance value at peak - highest saddle to any higher peak.
 * Low-prominence peaks are noise artifacts.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/10_markerExtraction/peakProminence.wgsl');

export async function runPeakProminence(gpuCtx, maxTex, distTex, params, registry) {
  const { device } = gpuCtx;
  const W = distTex.width, H = distTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "prominence_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("peakProminence", WGSL);

  const sws = params.sauvolaWindowBootstrap / 3; // rough stroke width estimate
  const minProminence = sws * 0.3; // peaks must protrude by at least 30% stroke width

  const uData = new Float32Array([W, H, minProminence, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bg = builder.buildBindGroup(pipeline, [maxTex.createView(), distTex.createView(), outTex.createView(), { buffer: uBuf }]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bg, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
