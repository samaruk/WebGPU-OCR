/**
 * gpu/helpers.js — GPU buffer allocation and uniform buffer creation utilities.
 *
 * WHY A DEDICATED HELPERS MODULE:
 *   Buffer creation involves repetitive boilerplate (usage flags, size alignment, queue
 *   writes). Centralising this in typed helper functions prevents copy-paste errors,
 *   enforces consistent size-alignment rules, and gives one place to add debugging
 *   (e.g. buffer name labels) without touching pipeline logic.
 *
 * UNIFORM BUFFER SIZE ALIGNMENT:
 *   WebGPU requires uniform buffers to have a minimum size of 16 bytes and to be aligned
 *   to 16-byte boundaries. mkUniBuf enforces this with Math.max(16, ceil(size/16)×16).
 *   Forgetting this would cause a GPUValidationError at bind-group creation time.
 *
 * uniTemps — TEMPORARY UNIFORM BUFFER POOL:
 *   uU32() and uMixed() create transient uniform buffers for each dispatch call. These
 *   buffers must outlive the GPU command that reads them (the GPU is asynchronous), but
 *   can be destroyed once the queue drains. The calling code calls
 *   gUniTemps.splice(0).forEach(b=>b.destroy()) after onSubmittedWorkDone() to batch-free
 *   all temp uniforms in one sweep. This is simpler and less error-prone than tracking
 *   individual buffer lifetimes per dispatch.
 */

import { gDev } from './device.js';

/**
 * uniTemps — Pool of temporary uniform buffers pending GPU completion.
 * Populated by mkUniBuf; drained by pipeline.js after onSubmittedWorkDone().
 */
export const uniTemps = [];

/**
 * mkStorBuf — Allocate a storage buffer usable for both shader access and CPU readback.
 *
 * WHY COPY_SRC | COPY_DST | STORAGE together:
 *   STORAGE allows shaders to read/write via bind groups.
 *   COPY_SRC is required for copyBufferToBuffer (readback staging) and copyBuf().
 *   COPY_DST is required for gDev.queue.writeBuffer() (uploading CPU data, e.g. labelArr).
 *   Combining all three gives maximum flexibility with minimal extra VRAM cost.
 */
export function mkStorBuf(bytes) {
  return gDev.createBuffer({
    size: bytes,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
}

/**
 * mkUniBuf — Upload a typed array as a 16-byte-aligned uniform buffer.
 * The buffer is registered in uniTemps for deferred destruction.
 *
 * WHY size = max(16, ceil(byteLength / 16) × 16):
 *   WebGPU validates that a uniform buffer binding covers at least minBindingSize bytes.
 *   Without padding, a 4-byte uniform (single u32) would fail validation. Aligning to 16
 *   bytes also satisfies GPU cache-line requirements on all currently shipping hardware.
 */
export function mkUniBuf(dataArr) {
  const size = Math.max(16, Math.ceil(dataArr.byteLength / 16) * 16);
  const buf = gDev.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  gDev.queue.writeBuffer(buf, 0, dataArr.buffer, dataArr.byteOffset, dataArr.byteLength);
  uniTemps.push(buf);
  return buf;
}

/**
 * uU32 — Create a uniform buffer from a variadic list of u32 values.
 *
 * WHY PAD TO MULTIPLE OF 4:
 *   Uint32Array must have a length that is a multiple of 4 for the 16-byte alignment rule.
 *   The padding zeroes are written into the buffer but ignored by the shader struct fields.
 *
 * USAGE: uU32(W, H)  →  struct P { width: u32, height: u32 }  (+ 2 padding slots)
 */
export function uU32(...vals) {
  const padded = [...vals];
  while (padded.length % 4) padded.push(0);
  return mkUniBuf(new Uint32Array(padded));
}

/**
 * uMixed — Create a uniform buffer from an array of {t, v} descriptors.
 * Supports mixed u32 / f32 fields in the same buffer (e.g. Sauvola params).
 *
 * WHY NECESSARY:
 *   Sauvola's uniform struct contains both u32 fields (width, height, radius) and f32 fields
 *   (k, R). JavaScript has no native "mixed typed array", so we build an ArrayBuffer and
 *   overlay both a Uint32Array and a Float32Array view onto it, writing each slot through
 *   the correct view. The resulting bytes are uploaded as-is to the GPU.
 *
 * USAGE: uMixed([{t:'u32',v:W}, {t:'f32',v:cfg.k}])
 */
export function uMixed(fields) {
  const padded = [...fields];
  while (padded.length % 4) padded.push({ t: 'u32', v: 0 });
  const ab  = new ArrayBuffer(padded.length * 4);
  const u32 = new Uint32Array(ab);
  const f32 = new Float32Array(ab);
  padded.forEach((f, i) => (f.t === 'u32' ? (u32[i] = f.v) : (f32[i] = f.v)));
  return mkUniBuf(new Uint8Array(ab));
}
