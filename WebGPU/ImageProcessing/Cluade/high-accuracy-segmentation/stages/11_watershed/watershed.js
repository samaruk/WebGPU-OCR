/**
 * stages/11_watershed/watershed.js
 * Marker-controlled watershed segmentation.
 * Only seeds from Stage 10 markers — no raw watershed flooding.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/11_watershed/watershed.wgsl');

export async function runWatershed(gpuCtx, distTex, markerTex, binaryTex, registry) {
  const { device } = gpuCtx;
  const W = distTex.width, H = distTex.height;
  // Label texture: r32uint for component IDs
  const labelTex = registry.createTexture(W, H, "r32uint", "watershed_labels");
  const builder  = new PipelineBuilder(device);
  const pipeline = await builder.build("watershed_flood", WGSL, "flood");

  const uData = new Float32Array([W, H, 0, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bg = builder.buildBindGroup(pipeline, [
    distTex.createView(), markerTex.createView(), binaryTex.createView(), labelTex.createView(), { buffer: uBuf },
  ]);

  // Iterative flooding (BFS approximation on GPU)
  const encoder = device.createCommandEncoder();
  const maxIter = Math.ceil(Math.max(W, H) / 2);
  for (let i = 0; i < maxIter; i++) {
    dispatch2D(encoder, pipeline, bg, W, H);
  }
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return labelTex;
}
