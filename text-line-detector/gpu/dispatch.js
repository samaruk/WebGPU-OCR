/**
 * gpu/dispatch.js — GPU command recording: dispatch, copy, readback, SAT orchestration.
 *
 * WHY A DEDICATED DISPATCH MODULE:
 *   Every GPU operation (dispatch, copy, readback) follows the same three-step pattern:
 *     1. Create a BindGroup matching the pipeline's BGL.
 *     2. Record commands into a CommandEncoder.
 *     3. Submit the encoder to the device queue.
 *   Abstracting this into typed functions prevents silent mistakes such as:
 *     • Providing buffers in the wrong order (which produces NaN results with no error).
 *     • Forgetting the COPY_SRC flag on readback staging buffers.
 *     • Using wrong workgroup counts (off-by-one in ceil division).
 *
 * COMMAND SUBMISSION MODEL:
 *   WebGPU is asynchronous: gDev.queue.submit() enqueues work on the GPU timeline.
 *   Reads back to CPU (readbackU32) must call gDev.queue.onSubmittedWorkDone() +
 *   buffer.mapAsync() to synchronise. All other dispatches are fire-and-forget —
 *   they form a dependency chain on the GPU timeline without stalling the CPU.
 */

import { gDev, gPipes, gBGLs } from './device.js';
import { uU32 }                 from './helpers.js';

/**
 * dispatch — Record and submit a single 2-D compute dispatch.
 *
 * WHY ONE COMMAND ENCODER PER DISPATCH:
 *   Batching multiple dispatches into one encoder is possible, but the pipeline code
 *   creates uniforms (uU32 calls) that must be written to GPU before the encoder
 *   records the dispatch. writeBuffer is a queue operation, not an encoder operation,
 *   so splitting into one encoder per dispatch is the simplest correct approach.
 *
 * @param {GPUComputePipeline} pipe
 * @param {GPUBindGroupLayout} bgl
 * @param {GPUBuffer[]} buffers — in binding-index order
 * @param {number} W — image width (used for ceil(W/16) x-workgroups)
 * @param {number} H — image height
 */
export function dispatch(pipe, bgl, buffers, W, H) {
  const bg = gDev.createBindGroup({
    layout: bgl,
    entries: buffers.map((buf, i) => ({ binding: i, resource: { buffer: buf } })),
  });
  const enc = gDev.createCommandEncoder();
  const cp  = enc.beginComputePass();
  cp.setPipeline(pipe);
  cp.setBindGroup(0, bg);
  cp.dispatchWorkgroups(Math.ceil(W / 16), Math.ceil(H / 16));
  cp.end();
  gDev.queue.submit([enc.finish()]);
}

/**
 * dispatch1D — Submit a 1-D compute dispatch (used for the stats-clear shader).
 *
 * WHY A SEPARATE FUNCTION:
 *   The stats-clear shader uses workgroup_size(256) over a flat array of K×3 elements.
 *   A 2-D dispatch (dispatch) would waste threads on the second dimension and complicate
 *   the thread→element mapping in the shader.
 *
 * @param {number} n — total element count; dispatches ceil(n/256) workgroups
 */
export function dispatch1D(pipe, bgl, buffers, n) {
  const bg = gDev.createBindGroup({
    layout: bgl,
    entries: buffers.map((buf, i) => ({ binding: i, resource: { buffer: buf } })),
  });
  const enc = gDev.createCommandEncoder();
  const cp  = enc.beginComputePass();
  cp.setPipeline(pipe);
  cp.setBindGroup(0, bg);
  cp.dispatchWorkgroups(Math.ceil(n / 256));
  cp.end();
  gDev.queue.submit([enc.finish()]);
}

/**
 * copyBuf — GPU-side buffer-to-buffer copy (no CPU round-trip).
 *
 * WHY NECESSARY:
 *   The Zhang-Suen thinning loop must start with a copy of the dilated image into sklA
 *   before the ping-pong passes begin. Using copyBufferToBuffer keeps the copy on the
 *   GPU timeline, avoiding an expensive GPU→CPU→GPU round-trip for what is effectively
 *   a memcpy.
 */
export function copyBuf(src, dst, bytes) {
  const enc = gDev.createCommandEncoder();
  enc.copyBufferToBuffer(src, 0, dst, 0, bytes);
  gDev.queue.submit([enc.finish()]);
}

/**
 * readbackU32 — Copy a GPU storage buffer to CPU and return it as a Uint32Array.
 *
 * WHY A STAGING BUFFER (MAP_READ):
 *   Storage buffers (STORAGE usage) cannot be mapped for CPU reading directly. WebGPU
 *   requires an intermediate MAP_READ | COPY_DST staging buffer. The GPU copies from
 *   the source to the staging buffer, then the CPU maps the staging buffer.
 *
 * WHY onSubmittedWorkDone() BEFORE mapAsync():
 *   mapAsync only resolves after all GPU commands that write to the buffer have finished.
 *   onSubmittedWorkDone() ensures all previously submitted queue work (including the
 *   copy just recorded) has completed before the map request is issued.
 *
 * @returns {Promise<Uint32Array>} — a detached copy; the staging buffer is destroyed.
 */
export async function readbackU32(srcBuf, count) {
  const rb = gDev.createBuffer({
    size: count * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const enc = gDev.createCommandEncoder();
  enc.copyBufferToBuffer(srcBuf, 0, rb, 0, count * 4);
  gDev.queue.submit([enc.finish()]);
  await gDev.queue.onSubmittedWorkDone();
  await rb.mapAsync(GPUMapMode.READ);
  const result = new Uint32Array(rb.getMappedRange().slice(0));
  rb.unmap();
  rb.destroy();
  return result;
}

/**
 * computeSAT — Build a 2-D Summed-Area Table from srcBuf using ping-pong scanning.
 *
 * WHY THIS ORCHESTRATION LIVES HERE (not in the pipeline):
 *   The SAT build is a multi-dispatch algorithm with internal state (which of {a, b} is
 *   the current read buffer). This state management is implementation detail that the
 *   pipeline (gpu/pipeline.js) should not need to know about. computeSAT encapsulates
 *   the doubling loop and returns the final result buffer, keeping pipeline.js clean.
 *
 * HOW THE PING-PONG WORKS:
 *   dispatch(sat, srcBuf→a, stride=1) then alternate a↔b for each stride doubling.
 *   The `cur` variable always points to the most recent complete scan result.
 *
 * @returns {GPUBuffer} — whichever of {a, b} holds the final SAT (may be either)
 */
export function computeSAT(srcBuf, a, b, W, H) {
  dispatch(gPipes.sat, gBGLs.sat, [srcBuf, a, uU32(W, H, 1, 0)], W, H);
  let cur = a, alt = b;
  for (let s = 2; s < W; s <<= 1) {
    dispatch(gPipes.sat, gBGLs.sat, [cur, alt, uU32(W, H, s, 0)], W, H);
    [cur, alt] = [alt, cur];
  }
  for (let s = 1; s < H; s <<= 1) {
    dispatch(gPipes.sat, gBGLs.sat, [cur, alt, uU32(W, H, s, 1)], W, H);
    [cur, alt] = [alt, cur];
  }
  return cur;
}
