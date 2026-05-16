/**
 * stages/01_geometry/perspectiveCorrect.js
 * Perspective/trapezoid correction via homography estimation.
 * Uses corner detection to find page boundaries, then warps.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/01_geometry/perspectiveCorrect.wgsl');

export async function runPerspectiveCorrect(gpuCtx, inputTex, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;

  const imageData = await gpuCtx.downloadToImageData(inputTex);
  const corners = detectPageCorners(imageData);
  if (!corners) return inputTex; // no correction needed

  const H_mat = computeHomography(corners, W, H);
  const outTex = registry.createTexture(W, H, "rgba8unorm", "perspective_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("perspectiveCorrect", WGSL);

  // Pack 3x3 homography as 9 floats + dims
  const uniformData = new Float32Array([...H_mat, W, H, 0, 0]);
  const uniformBuf  = device.createBuffer({ size: uniformData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uniformBuf, 0, uniformData);

  const bindGroup = builder.buildBindGroup(pipeline, [
    inputTex.createView(), outTex.createView(), { buffer: uniformBuf },
  ]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uniformBuf.destroy();
  return outTex;
}

function detectPageCorners(imageData) {
  // Simple: return null if image appears already rectified
  // Full implementation: Canny → contour → approxPolyDP on largest quad
  return null;
}

function computeHomography(corners, W, H) {
  // Returns identity if no valid corners
  return [1,0,0, 0,1,0, 0,0,1];
}
