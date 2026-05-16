/**
 * pipeline/stage5-extract.js
 * Stage 5 — Final Circle Extraction.
 *
 * Dispatches a single workgroup that:
 *   1. Performs the last tree-reduction over ≤256 partial results.
 *   2. Decodes the winning pixel index back to (cx, cy).
 *   3. Writes [cx, cy, radius, 0] as 4×f32 into resBuf.
 *
 * After this pass, only 16 bytes need to be copied from GPU → CPU
 * (via a staging buffer mapAsync).  This is the ONLY data transfer
 * in the entire pipeline.
 *
 * @param {GPUComputePassEncoder} cp
 * @param {GPUComputePipeline}    pipeline
 * @param {GPUDevice}             device
 * @param {GPUBuffer}             finalInBuf  — last reduction level output
 * @param {GPUBuffer}             resBuf      — output: f32[4] = [cx, cy, r, 0]
 * @param {GPUBuffer}             uExtract    — uniform: { count, width, 0, 0 }
 */
import { log } from '../ui/log.js';

export function stage5Extract(cp, pipeline, device, finalInBuf, resBuf, uExtract) {
  cp.setPipeline(pipeline);
  cp.setBindGroup(0, device.createBindGroup({
    label  : 'extract-bg',
    layout : pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: finalInBuf } },
      { binding: 1, resource: { buffer: resBuf     } },
      { binding: 2, resource: { buffer: uExtract   } },
    ],
  }));

  // Always one workgroup — the extract shader handles ≤256 partial inputs
  cp.dispatchWorkgroups(1);
  log('[5] Extract  single workgroup  → 16B result (cx, cy, r, 0)', 'info');
}

/**
 * Read back the 16-byte circle result from the GPU staging buffer.
 * Must be called AFTER device.queue.onSubmittedWorkDone() has resolved.
 *
 * @param {GPUBuffer} stagingBuf — MAP_READ buffer already filled by copyBufferToBuffer
 * @returns {Promise<{ cx: number, cy: number, radius: number }>}
 */
export async function readCircleResult(stagingBuf) {
  await stagingBuf.mapAsync(GPUMapMode.READ);
  const raw    = stagingBuf.getMappedRange().slice(0);
  stagingBuf.unmap();

  const f32 = new Float32Array(raw);
  return {
    cx    : Math.round(f32[0]),
    cy    : Math.round(f32[1]),
    radius: f32[2],
  };
}
