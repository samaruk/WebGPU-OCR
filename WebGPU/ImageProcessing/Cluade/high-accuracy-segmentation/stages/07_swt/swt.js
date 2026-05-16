/**
 * stages/07_swt/swt.js
 * Stroke Width Transform on stabilized binary image.
 * Fires rays along gradient directions; ray terminates when gradient reverses.
 * Returns r32float texture with stroke width per pixel.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/07_swt/swt.wgsl');

export async function runSWT(gpuCtx, binaryTex, params, registry) {
  const { device } = gpuCtx;
  const W = binaryTex.width, H = binaryTex.height;
  const swtTex = registry.createTexture(W, H, "r32float", "swt_map");

  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("swt", WGSL);

  const uData = new Float32Array([W, H, params.swtMaxRayLength, params.swtCannyLow, params.swtCannyHigh, 0, 0, 0]);
  const uBuf  = device.createBuffer({ size: uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bindGroup = builder.buildBindGroup(pipeline, [
    binaryTex.createView(), swtTex.createView(), { buffer: uBuf },
  ]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return swtTex;
}
