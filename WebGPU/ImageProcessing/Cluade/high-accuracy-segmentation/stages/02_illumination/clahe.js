/**
 * stages/02_illumination/clahe.js
 * Contrast Limited Adaptive Histogram Equalization.
 * Clip limit from paramResolver (adaptively set from quality scores).
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/02_illumination/clahe.wgsl');

const TILE_SIZE = 64;

export async function runCLAHE(gpuCtx, inputTex, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "clahe_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("clahe", WGSL);

  const tilesX = Math.ceil(W / TILE_SIZE);
  const tilesY = Math.ceil(H / TILE_SIZE);

  const uData = new Float32Array([W, H, TILE_SIZE, params.claheClipLimit, tilesX, tilesY, 0, 0]);
  const uBuf  = device.createBuffer({ size: uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  // Histogram buffer: tilesX * tilesY * 256 entries
  const histBuf = device.createBuffer({
    size: tilesX * tilesY * 256 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = builder.buildBindGroup(pipeline, [
    inputTex.createView(), outTex.createView(), { buffer: uBuf }, { buffer: histBuf },
  ]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy(); histBuf.destroy();
  return outTex;
}
