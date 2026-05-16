/**
 * gpu/utils.js
 * Shared GPU helper utilities used across pipeline stages.
 */

/**
 * Create a UNIFORM buffer aligned to 16 bytes and immediately write data.
 * @param {GPUDevice}   device
 * @param {TypedArray}  typedArray  — Uint32Array or Float32Array
 * @returns {GPUBuffer}
 */
export function makeUniformBuffer(device, typedArray) {
  const size = Math.max(16, Math.ceil(typedArray.byteLength / 16) * 16);
  const buf  = device.createBuffer({
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buf, 0, typedArray);
  return buf;
}

/**
 * Compile and return a GPUComputePipeline from WGSL source.
 * @param {GPUDevice} device
 * @param {string}    code   — WGSL shader source
 * @param {string}    label  — debug label
 * @returns {GPUComputePipeline}
 */
export function makeComputePipeline(device, code, label) {
  return device.createComputePipeline({
    label,
    layout : 'auto',
    compute: {
      module    : device.createShaderModule({ code, label }),
      entryPoint: 'main',
    },
  });
}

/**
 * Allocate a STORAGE buffer (optional COPY_SRC flag).
 * @param {GPUDevice} device
 * @param {number}    size       — byte size (min 16)
 * @param {boolean}   copySrc    — also add COPY_SRC usage
 * @returns {GPUBuffer}
 */
export function makeStorageBuffer(device, size, copySrc = false) {
  let usage = GPUBufferUsage.STORAGE;
  if (copySrc) usage |= GPUBufferUsage.COPY_SRC;
  return device.createBuffer({ size: Math.max(size, 16), usage });
}

/**
 * Allocate a MAP_READ + COPY_DST staging buffer.
 */
export function makeStagingBuffer(device, size) {
  return device.createBuffer({
    size : Math.max(size, 16),
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
}
