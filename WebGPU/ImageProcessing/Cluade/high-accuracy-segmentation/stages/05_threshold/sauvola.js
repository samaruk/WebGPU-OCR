/**
 * stages/05_threshold/sauvola.js
 * Two-pass Sauvola adaptive thresholding.
 * Pass 1: DPI-based window (bootstrap before SWT).
 * Pass 2: stroke-width-corrected window (better accuracy).
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { adaptiveHeuristics } from "../../adaptive/adaptiveHeuristics.js";
import { runRunLengthStrokeEst } from "./runLengthStrokeEst.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/05_threshold/sauvola.wgsl');

export async function runSauvola(gpuCtx, inputTex, params, sws, registry) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;

  // ── Pass 1: DPI bootstrap ───────────────────────────────────────────────────
  const win1 = params.sauvolaWindowBootstrap;
  const pass1 = await sauvolaPass(gpuCtx, inputTex, params, win1, registry, "sauvola_p1");

  // ── Stroke estimate from Pass 1 binary ──────────────────────────────────────
  const strokeEst = await runRunLengthStrokeEst(gpuCtx, pass1, registry);

  // ── Pass 2: stroke-corrected window ─────────────────────────────────────────
  const win2 = adaptiveHeuristics.sauvolaWindowFromStroke(strokeEst);
  const pass2 = await sauvolaPass(gpuCtx, inputTex, params, win2, registry, "sauvola_p2");

  // Write stroke estimate to store for early consumers (SWT will override with full distribution)
  if (!sws.isReady()) sws.meanStrokeWidth = strokeEst;

  return pass2;
}

async function sauvolaPass(gpuCtx, inputTex, params, windowSize, registry, label) {
  const { device } = gpuCtx;
  const W = inputTex.width, H = inputTex.height;
  const outTex = registry.createTexture(W, H, "rgba8unorm", label);
  const builder = new PipelineBuilder(device);
  const pipeline = await builder.build("sauvola", WGSL);

  const uData = new Float32Array([W, H, windowSize, params.sauvolaK, params.sauvolaR, 0, 0, 0]);
  const uBuf  = device.createBuffer({ size: uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const bindGroup = builder.buildBindGroup(pipeline, [inputTex.createView(), outTex.createView(), { buffer: uBuf }]);
  const encoder = device.createCommandEncoder();
  dispatch2D(encoder, pipeline, bindGroup, W, H);
  await gpuCtx.submit(encoder);
  uBuf.destroy();
  return outTex;
}
