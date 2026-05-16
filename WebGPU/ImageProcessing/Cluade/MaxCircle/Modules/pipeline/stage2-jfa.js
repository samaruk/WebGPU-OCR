/**
 * pipeline/stage2-jfa.js
 * Stage 2 — Jump Flood Algorithm (JFA).
 *
 * Runs log₂(max(W,H)) compute passes.  Each pass reads from one buffer
 * and writes to another (ping-pong), so there are no read-write hazards.
 *
 * Step schedule: N/2, N/4, N/8, … 2, 1
 * After all passes every foreground pixel holds the coordinate of its
 * nearest background seed (exact for JFA, with occasional 1-pixel error
 * at corners — negligible for circle placement purposes).
 *
 * Returns the buffer that holds the final JFA result (ping or pong,
 * whichever was written last).
 *
 * @param {GPUComputePassEncoder} cp
 * @param {GPUComputePipeline}    pipeline
 * @param {GPUDevice}             device
 * @param {GPUBuffer}             pingBuf   — first JFA buffer (vec2u per pixel)
 * @param {GPUBuffer}             pongBuf   — second JFA buffer (vec2u per pixel)
 * @param {GPUBuffer[]}           jfaUniforms  — one uniform buffer per pass
 * @param {number}                W
 * @param {number}                H
 * @returns {GPUBuffer} finalBuf — the buffer containing nearest-seed result
 */
import { log } from '../ui/log.js';

export function stage2JFA(cp, pipeline, device, pingBuf, pongBuf, jfaUniforms, W, H) {
  const jN   = jfaUniforms.length;
  let rBuf   = pingBuf;
  let wBuf   = pongBuf;

  for (let i = 0; i < jN; i++) {
    cp.setPipeline(pipeline);
    cp.setBindGroup(0, device.createBindGroup({
      label  : `jfa-pass-${i}`,
      layout : pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rBuf          } },
        { binding: 1, resource: { buffer: wBuf          } },
        { binding: 2, resource: { buffer: jfaUniforms[i] } },
      ],
    }));
    cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));

    // Swap ping-pong for next pass
    [rBuf, wBuf] = [wBuf, rBuf];
  }

  log(`[2] JFA  ${jN} passes  (step N/2 → 1)  ${Math.ceil(W/8)}×${Math.ceil(H/8)} wg/pass`, 'info');

  // After an even number of swaps rBuf may be pingBuf again — return the
  // buffer that was most recently written (now called rBuf after last swap).
  return rBuf;
}

/**
 * Build per-pass JFA uniform buffers (one per JFA pass).
 * Each carries { step, W, H, pad }.
 *
 * @param {GPUDevice} device
 * @param {number}    W
 * @param {number}    H
 * @param {Function}  makeUniformBuffer   — from gpu/utils.js
 * @returns {GPUBuffer[]}
 */
export function buildJFAUniforms(device, W, H, makeUniformBuffer) {
  const jN     = Math.ceil(Math.log2(Math.max(W, H)));
  const result = [];
  let   step   = Math.ceil(Math.max(W, H) / 2);

  for (let i = 0; i < jN; i++) {
    result.push(makeUniformBuffer(device, new Uint32Array([step, W, H, 0])));
    step = Math.max(1, step >> 1);
  }
  return result;
}
