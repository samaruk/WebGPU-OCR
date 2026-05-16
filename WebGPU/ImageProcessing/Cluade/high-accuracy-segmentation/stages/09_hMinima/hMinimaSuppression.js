/**
 * stages/09_hMinima/hMinimaSuppression.js
 * h-Minima transform: suppress all local minima shallower than h.
 * On the distance map, this merges nearby peaks that would cause over-segmentation.
 * h = adaptiveHeuristics.hValue(meanStrokeWidth)
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { adaptiveHeuristics } from "../../adaptive/adaptiveHeuristics.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/09_hMinima/hMinimaSuppression.wgsl');

export async function runHMinima(gpuCtx, distTex, sws, params, registry) {
  const { device } = gpuCtx;
  const W = distTex.width, H = distTex.height;

  const msw = sws.get(8);
  const h   = adaptiveHeuristics.hValue(msw, 1.0 + params.qualityVector.noiseRatio);

  const outTex = registry.createTexture(W, H, "r32float", "hminima_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("hMinima", WGSL);

  const uData = new Float32Array([W, H, h, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bindGroup = builder.buildBindGroup(pipeline, [distTex.createView(), outTex.createView(), { buffer: uBuf }]);

  // Iterative suppression (converges in ~h iterations)
  const iters = Math.ceil(h) + 2;
  const encoder = device.createCommandEncoder();
  for (let i = 0; i < iters; i++) {
    dispatch2D(encoder, pipeline, bindGroup, W, H);
  }
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
