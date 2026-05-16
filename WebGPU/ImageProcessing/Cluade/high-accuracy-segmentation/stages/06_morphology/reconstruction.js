/**
 * stages/06_morphology/reconstruction.js
 * Morphological reconstruction by dilation (marker-based).
 * Removes small isolated noise blobs while preserving connected text structures.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/06_morphology/reconstruction.wgsl');

export async function runReconstruction(gpuCtx, binaryTex, params, registry) {
  const { device } = gpuCtx;
  const W = binaryTex.width, H = binaryTex.height;

  // Erosion → seed. Then iteratively dilate seed under mask = original binary.
  // This removes blobs smaller than the structuring element.
  const se_radius = 2; // structuring element
  let current = binaryTex;

  const builder = new PipelineBuilder(device);

  // Step 1: Erode to get seed
  const erosionPipeline = await builder.build("morpho_erode", WGSL, "erode");
  const seedTex = registry.createTexture(W, H, "rgba8unorm", "morpho_seed");
  const uData = new Float32Array([W, H, se_radius, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  let bg = builder.buildBindGroup(erosionPipeline, [binaryTex.createView(), seedTex.createView(), { buffer: uBuf }]);
  let enc = device.createCommandEncoder();
  dispatch2D(enc, erosionPipeline, bg, W, H);
  await gpuCtx.submit(enc);

  // Step 2: Iterative reconstruction (dilate seed, clip to mask)
  const reconPipeline = await builder.build("morpho_recon", WGSL, "reconstruct");
  const reconTex = registry.createTexture(W, H, "rgba8unorm", "morpho_recon");
  let iter = 0;
  current = seedTex;
  while (iter < 30) {
    bg = builder.buildBindGroup(reconPipeline, [
      current.createView(), binaryTex.createView(), reconTex.createView(), { buffer: uBuf },
    ]);
    enc = device.createCommandEncoder();
    dispatch2D(enc, reconPipeline, bg, W, H);
    await gpuCtx.submit(enc);
    current = reconTex;
    iter++;
  }

  uBuf.destroy();
  return current;
}
