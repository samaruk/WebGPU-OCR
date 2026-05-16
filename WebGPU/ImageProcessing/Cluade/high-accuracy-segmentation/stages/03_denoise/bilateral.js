/**
 * stages/03_denoise/bilateral.js - Edge-preserving bilateral filter.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/03_denoise/bilateral.wgsl');

export async function runBilateral(gpuCtx, inputTex, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "bilateral_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("bilateral", WGSL);

  const uData = new Float32Array([W, H, params.bilateralSigmaSpace, params.bilateralSigmaColor, 0, 0, 0, 0]);
  const uBuf  = device.createBuffer({ size: uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bindGroup = builder.buildBindGroup(pipeline, [inputTex.createView(), outTex.createView(), { buffer: uBuf }]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
