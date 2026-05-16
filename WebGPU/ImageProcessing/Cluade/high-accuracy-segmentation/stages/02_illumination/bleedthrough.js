/**
 * stages/02_illumination/bleedthrough.js
 * Frequency-domain bleedthrough/shadow separation using frequency-split approach.
 * Separates low-frequency background from high-frequency text content.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/02_illumination/bleedthrough.wgsl');

export async function runBleedthrough(gpuCtx, inputTex, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "bleedthrough_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("bleedthrough", WGSL);

  // Large Gaussian kernel radius to capture background illumination
  const radius = Math.round(Math.max(W, H) * 0.04);
  const uData  = new Float32Array([W, H, radius, 0]);
  const uBuf   = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bindGroup = builder.buildBindGroup(pipeline, [
    inputTex.createView(), outTex.createView(), { buffer: uBuf },
  ]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
