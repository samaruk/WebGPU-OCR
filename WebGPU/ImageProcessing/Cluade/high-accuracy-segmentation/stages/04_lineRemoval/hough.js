/**
 * stages/04_lineRemoval/hough.js
 * Width-gated Hough line detection and removal.
 * Runs on denoised grayscale — not binary — for maximum accumulator signal.
 * Lines thicker than widthGateFactor * strokeWidth are skipped (protecting bold text).
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
const WGSL = await loadShader('./stages/04_lineRemoval/hough.wgsl');
import { runWidthGateFilter } from "./widthGateFilter.js";
import { loadShader } from "../../core/loadShader.js";

export async function runHough(gpuCtx, inputTex, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;

  // Accumulator dimensions
  const numAngles = 360;
  const diagLen   = Math.ceil(Math.sqrt(W*W + H*H));
  const numRhos   = diagLen * 2;

  const accumBuf = device.createBuffer({
    size: numAngles * numRhos * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const builder  = new PipelineBuilder(device);
  const pipeline = await builder.build("hough_vote", WGSL, "vote");

  const uData = new Float32Array([W, H, numAngles, numRhos, diagLen, params.houghThreshold, 0, 0]);
  const uBuf  = device.createBuffer({ size: uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  // Vote pass
  const voteGroup = builder.buildBindGroup(pipeline, [
    inputTex.createView(), { buffer: accumBuf }, { buffer: uBuf },
  ]);
  const enc1 = device.createCommandEncoder();
  const pass1 = enc1.beginComputePass();
  pass1.setPipeline(pipeline);
  pass1.setBindGroup(0, voteGroup);
  pass1.dispatchWorkgroups(Math.ceil(W/8), Math.ceil(H/8));
  pass1.end();
  await gpuCtx.submit(enc1);

  // Removal pass — mask detected lines
  const outTex = registry.createTexture(W, H, "rgba8unorm", "hough_out");
  const pipelineRemove = await builder.build("hough_remove", WGSL, "remove");
  const removeGroup = builder.buildBindGroup(pipelineRemove, [
    inputTex.createView(), outTex.createView(), { buffer: accumBuf }, { buffer: uBuf },
  ]);
  const enc2 = device.createCommandEncoder();
  dispatch2D(enc2, pipelineRemove, removeGroup, W, H);
  await gpuCtx.submit(enc2);

  accumBuf.destroy(); uBuf.destroy();

  // Width gate post-filter
  return runWidthGateFilter(gpuCtx, inputTex, outTex, params, registry);
}
