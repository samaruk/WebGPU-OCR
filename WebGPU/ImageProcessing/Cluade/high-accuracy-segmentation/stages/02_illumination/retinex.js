/**
 * stages/02_illumination/retinex.js
 * Multi-Scale Retinex (MSR) for illumination normalization.
 * Three Gaussian scales combined with equal weights.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/02_illumination/retinex.wgsl');

const SCALES = [15, 80, 250]; // Small, medium, large σ

export async function runRetinex(gpuCtx, inputTex, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "retinex_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("retinex", WGSL);

  const uData = new Float32Array([W, H, SCALES[0], SCALES[1], SCALES[2], 0, 0, 0]);
  const uBuf  = device.createBuffer({ size: uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
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
