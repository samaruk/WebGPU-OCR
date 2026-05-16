/**
 * stages/10_markerExtraction/strokeConsistencyFilter.js
 * Validates marker peaks against the SWT map.
 * Peaks in regions with inconsistent stroke widths (noise, artifacts)
 * are removed. Only keeps peaks where local SWT is consistent.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/10_markerExtraction/strokeConsistencyFilter.wgsl');

export async function runStrokeConsistency(gpuCtx, markerTex, swtTex, sws, params, registry) {
  if (sws.fallbackMode) return markerTex; // skip if SWT unreliable

  const { device } = gpuCtx;
  const W = markerTex.width, H = markerTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "stroke_consist_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("strokeConsistency", WGSL);

  const msw = sws.get(8);
  const tolerance = sws.strokeWidthStdDev ?? msw * 0.5;

  const uData = new Float32Array([W, H, msw, tolerance, 0, 0, 0, 0]);
  const uBuf  = device.createBuffer({ size: uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bg = builder.buildBindGroup(pipeline, [
    markerTex.createView(), swtTex.createView(), outTex.createView(), { buffer: uBuf },
  ]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bg, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
