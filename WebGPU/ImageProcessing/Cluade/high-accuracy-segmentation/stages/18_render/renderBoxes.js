/**
 * stages/18_render/renderBoxes.js
 * Renders rotated bounding boxes overlaid on the corrected grayscale image.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
const WGSL = await loadShader('./stages/18_render/renderBoxes.wgsl');
import { Config } from "../../config.js";
import { loadShader } from "../../core/loadShader.js";

export async function runRenderBoxes(gpuCtx, inputTex, bboxes, params, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", "render_out");

  // Copy input to output first (CPU side for simplicity)
  const encoder0 = device.createCommandEncoder();
  encoder0.copyTextureToTexture({ texture: inputTex }, { texture: outTex }, { width: W, height: H });
  device.queue.submit([encoder0.finish()]);

  // Draw boxes using 2D canvas overlay
  const imageData = await gpuCtx.downloadToImageData(outTex);
  const offscreen = new OffscreenCanvas(W, H);
  const ctx = offscreen.getContext("2d");
  ctx.putImageData(imageData, 0, 0);

  ctx.strokeStyle = `rgba(${Config.RENDER_BOX_COLOR.map((v,i)=>i<3?Math.round(v*255):v).join(",")})`;
  ctx.lineWidth   = Config.RENDER_BOX_THICKNESS;

  for (const box of bboxes) {
    const { x1, y1, x2, y2, angle, cx, cy, w, h } = box;
    if (Math.abs(angle) < 2) {
      // Axis-aligned
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else {
      // Rotated
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle * Math.PI / 180);
      ctx.strokeRect(-w/2, -h/2, w, h);
      ctx.restore();
    }
  }

  const finalData = ctx.getImageData(0, 0, W, H);
  return gpuCtx.uploadImageData(finalData);
}
