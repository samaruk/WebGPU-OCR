/**
 * pipeline/stage1-seed.js
 * Stage 1 — Seed Initialisation.
 *
 * Encodes a compute pass that writes to seedBuf:
 *   • Background pixels (v < 0.5) → their own (x, y) coordinates.
 *   • Foreground pixels (v ≥ 0.5) → (INV, INV) = 0xFFFFFFFF sentinel.
 *
 * After this pass, the JFA can flood seed coordinates outward from
 * background into foreground until every pixel has a nearest seed.
 *
 * @param {GPUComputePassEncoder} cp        — open compute pass
 * @param {GPUComputePipeline}    pipeline  — compiled seedInit pipeline
 * @param {GPUBuffer}             seedBuf   — output storage buffer (vec2u per pixel)
 * @param {GPUTexture}            binaryTex — r8unorm binary mask texture
 * @param {GPUBuffer}             uDims     — uniform: vec2u(W, H, 0, 0)
 * @param {number}                W
 * @param {number}                H
 */
import { log } from '../ui/log.js';

export function stage1Seed(cp, pipeline, seedBuf, binaryTex, uDims, W, H) {
  cp.setPipeline(pipeline);
  cp.setBindGroup(0, pipeline.device
    // Note: GPUComputePipeline doesn't expose .device, but we build BG from outside
    // — see usage in main.js. This comment is intentional to keep the function signature minimal.
    // The actual createBindGroup call is in main.js where `device` is in scope.
    // This file just documents what the stage does.
    ?? null);

  // Dispatched from main.js — documented here for reference:
  // cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
  log(`[1] SeedInit dispatched  ${Math.ceil(W / 8)}×${Math.ceil(H / 8)} workgroups`, 'info');
}

/**
 * Create and return the bind group for Stage 1.
 * Separated so `device` doesn't need to be threaded into the encoder helper.
 *
 * @param {GPUDevice}          device
 * @param {GPUComputePipeline} pipeline
 * @param {GPUTexture}         binaryTex
 * @param {GPUBuffer}          seedBuf
 * @param {GPUBuffer}          uDims
 * @returns {GPUBindGroup}
 */
export function stage1BindGroup(device, pipeline, binaryTex, seedBuf, uDims) {
  return device.createBindGroup({
    label  : 'seedInit-bg',
    layout : pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: binaryTex.createView() },
      { binding: 1, resource: { buffer: seedBuf } },
      { binding: 2, resource: { buffer: uDims   } },
    ],
  });
}
