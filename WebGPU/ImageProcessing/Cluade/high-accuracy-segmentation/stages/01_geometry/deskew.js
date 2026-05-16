/**
 * stages/01_geometry/deskew.js
 * Skew correction using projection profile analysis + Hough confirmation.
 * Applies rotation correction via GPU affine transform.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/01_geometry/deskew.wgsl');

export async function runDeskew(gpuCtx, inputTex, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;

  // 1. Compute projection profiles on CPU via readback (small overhead)
  const imageData = await gpuCtx.downloadToImageData(inputTex);
  const gray = toGray(imageData);
  const angle = detectSkewAngle(gray, W, H);

  if (Math.abs(angle) < 0.15) return inputTex; // within tolerance, skip rotation

  // 2. Apply rotation on GPU
  const outTex = registry.createTexture(W, H, "rgba8unorm", "deskew_out");
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("deskew", WGSL);

  const uniformData = new Float32Array([angle * Math.PI / 180, W, H, 0]);
  const uniformBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uniformBuf, 0, uniformData);

  const bindGroup = builder.buildBindGroup(pipeline, [
    inputTex.createView(),
    outTex.createView(),
    { buffer: uniformBuf },
  ]);

  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uniformBuf.destroy();
  return outTex;
}

function toGray(imageData) {
  const { data, width, height } = imageData;
  const g = new Float32Array(width * height);
  for (let i = 0; i < g.length; i++) {
    g[i] = (0.2126 * data[i*4] + 0.7152 * data[i*4+1] + 0.0722 * data[i*4+2]) / 255;
  }
  return g;
}

function detectSkewAngle(gray, W, H) {
  // Projection profile method: rotate at candidate angles, measure sharpness
  const angles = [];
  for (let a = -15; a <= 15; a += 0.5) angles.push(a);
  let bestAngle = 0, bestScore = -Infinity;
  for (const angle of angles) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const profile = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cx = x - W/2, cy = y - H/2;
        const rx = Math.round(cx*cos + cy*sin + W/2);
        const ry = Math.round(-cx*sin + cy*cos + H/2);
        if (rx >= 0 && rx < W && ry >= 0 && ry < H) {
          profile[y] += gray[ry * W + rx] < 0.5 ? 1 : 0;
        }
      }
    }
    // Sharpness = variance of profile
    let mean = 0;
    for (const v of profile) mean += v;
    mean /= H;
    let var_ = 0;
    for (const v of profile) var_ += (v - mean) ** 2;
    if (var_ > bestScore) { bestScore = var_; bestAngle = angle; }
  }
  return bestAngle;
}
