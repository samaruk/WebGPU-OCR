/**
 * stages/08_distance/distanceTransform.js
 * Euclidean Distance Transform on binary foreground.
 * Uses separable 1D passes (Meijster algorithm approximation on GPU).
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/08_distance/distanceTransform.wgsl');

export async function runDistanceTransform(gpuCtx, binaryTex, registry) {
  const { device } = gpuCtx;
  const W = binaryTex.width, H = binaryTex.height;

  // Pass 1: horizontal EDT
  const hTex = registry.createTexture(W, H, "r32float", "edt_h");
  // Pass 2: vertical EDT
  const vTex = registry.createTexture(W, H, "r32float", "edt_v");

  const builder  = new PipelineBuilder(device);
  const pipelineH = await builder.build("edt_h", WGSL, "horizontal");
  const pipelineV = await builder.build("edt_v", WGSL, "vertical");

  const uData = new Float32Array([W, H, 0, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bgH = builder.buildBindGroup(pipelineH, [binaryTex.createView(), hTex.createView(), { buffer: uBuf }]);
  const enc1 = device.createCommandEncoder();
  dispatch2D(enc1, pipelineH, bgH, W, H);
  await gpuCtx.submit(enc1);

  const bgV = builder.buildBindGroup(pipelineV, [hTex.createView(), vTex.createView(), { buffer: uBuf }]);
  const enc2 = device.createCommandEncoder();
  dispatch2D(enc2, pipelineV, bgV, W, H);
  await gpuCtx.submit(enc2);

  uBuf.destroy();
  return vTex;
}
