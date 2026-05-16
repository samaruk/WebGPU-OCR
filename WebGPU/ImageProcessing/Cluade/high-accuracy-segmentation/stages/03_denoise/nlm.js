/**
 * stages/03_denoise/nlm.js
 * Non-Local Means denoising — selected by qualityScorer when noise is high.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/03_denoise/nlm.wgsl');

export async function runNLM(gpuCtx, inputTex, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "nlm_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("nlm", WGSL);

  const uData = new Float32Array([
    W, H, params.nlmH, params.nlmTemplateRadius, params.nlmSearchRadius, 0, 0, 0
  ]);
  const uBuf = device.createBuffer({ size: uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bindGroup = builder.buildBindGroup(pipeline, [inputTex.createView(), outTex.createView(), { buffer: uBuf }]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
