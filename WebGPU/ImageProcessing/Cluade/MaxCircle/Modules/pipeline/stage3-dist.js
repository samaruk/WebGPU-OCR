/**
 * pipeline/stage3-dist.js
 * Stage 3 — Euclidean Distance Field.
 *
 * Converts per-pixel nearest-seed coordinates (from JFA) into true
 * Euclidean distances: dist[px] = √((px.x − seed.x)² + (px.y − seed.y)²).
 *
 * FP16 mode:
 *   When fp16 = true the dist buffer uses f16 (16-bit float) storage.
 *   This halves the buffer size compared to f32, doubling effective
 *   memory bandwidth on the distance computation and all subsequent reads.
 *   Precision: f16 has ~3 decimal digits — sufficient for pixel-level
 *   circle-center detection up to images of ~65k px width.
 *
 * @param {GPUComputePassEncoder} cp
 * @param {GPUComputePipeline}    pipeline
 * @param {GPUDevice}             device
 * @param {GPUBuffer}             seedBuf   — JFA result buffer (vec2u per px)
 * @param {GPUBuffer}             distBuf   — output dist buffer (f32|f16 per px)
 * @param {GPUBuffer}             uDims     — uniform: vec2u(W, H)
 * @param {number}                W
 * @param {number}                H
 * @param {boolean}               fp16
 */
import { log } from '../ui/log.js';

export function stage3Dist(cp, pipeline, device, seedBuf, distBuf, uDims, W, H, fp16) {
  const TOTAL = W * H;

  cp.setPipeline(pipeline);
  cp.setBindGroup(0, device.createBindGroup({
    label  : 'distField-bg',
    layout : pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: seedBuf } },
      { binding: 1, resource: { buffer: distBuf } },
      { binding: 2, resource: { buffer: uDims   } },
    ],
  }));
  cp.dispatchWorkgroups(Math.ceil(TOTAL / 64));

  log(
    `[3] DistField  type=${fp16 ? 'f16 — 2× memory bandwidth' : 'f32'}` +
    `  ${Math.ceil(TOTAL / 64)} workgroups`,
    'info',
  );
}

/**
 * Compute the byte size of the distance buffer.
 * @param {number}  total  — W * H
 * @param {boolean} fp16
 * @returns {number} byte size (minimum 16)
 */
export function distBufferSize(total, fp16) {
  return Math.max(total * (fp16 ? 2 : 4), 16);
}
