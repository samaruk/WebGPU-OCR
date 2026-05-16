// core/dispatchUtils.js — Helper utilities for compute dispatch

export const WG_SIZE = 8; // default workgroup size (x and y)

/**
 * Calculate the number of workgroups needed to cover `size` elements
 * with workgroups of `wgSize`.
 */
export function dispatchCount(size, wgSize = WG_SIZE) {
  return Math.ceil(size / wgSize);
}

/**
 * Dispatch a 2D compute pass over a width × height grid.
 */
export function dispatch2D(passEncoder, pipeline, bindGroup, width, height, wgSize = WG_SIZE) {
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(
    dispatchCount(width, wgSize),
    dispatchCount(height, wgSize)
  );
}

/**
 * Dispatch a 1D compute pass over `count` elements.
 */
export function dispatch1D(passEncoder, pipeline, bindGroup, count, wgSize = 64) {
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(dispatchCount(count, wgSize));
}

/**
 * Create a uniform buffer and write a Uint32Array of params.
 */
export function createUniformBuffer(device, u32Values, label = 'uniforms') {
  const data = new Uint32Array(u32Values);
  const buf = device.createBuffer({
    label,
    size: Math.max(16, alignTo(data.byteLength, 16)),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(buf.getMappedRange()).set(data);
  buf.unmap();
  return buf;
}

/**
 * Update an existing uniform buffer.
 */
export function updateUniformBuffer(device, buffer, u32Values) {
  device.queue.writeBuffer(buffer, 0, new Uint32Array(u32Values));
}

/**
 * Create a storage buffer initialized with data.
 */
export function createStorageBuffer(device, data, label = 'storage') {
  const byteArray = data instanceof Uint8Array ? data : new Uint8Array(data.buffer);
  const buf = device.createBuffer({
    label,
    size: Math.max(16, alignTo(byteArray.byteLength, 4)),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint8Array(buf.getMappedRange()).set(byteArray);
  buf.unmap();
  return buf;
}

/**
 * Create a zeroed storage buffer of given size in bytes.
 */
export function createZeroedBuffer(device, sizeBytes, label = 'zeroed') {
  const buf = device.createBuffer({
    label,
    size: Math.max(16, alignTo(sizeBytes, 4)),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  return buf;
}

function alignTo(n, alignment) {
  return Math.ceil(n / alignment) * alignment;
}
