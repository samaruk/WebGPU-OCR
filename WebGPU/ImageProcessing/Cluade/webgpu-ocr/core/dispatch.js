// Compute dispatch helpers

/** Ceiling division for workgroup count */
export function wgCount(size, wgSize) {
  return Math.ceil(size / wgSize);
}

/** Build a 2-D dispatch: ceil(W/wx) x ceil(H/wy) */
export function dispatch2D(pass, pipeline, bindGroup, W, H, wx = 8, wy = 8) {
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(wgCount(W, wx), wgCount(H, wy), 1);
}

/** Build a 1-D dispatch over N elements */
export function dispatch1D(pass, pipeline, bindGroup, N, wx = 256) {
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(wgCount(N, wx), 1, 1);
}

/**
 * Create a uniform buffer from a TypedArray and write it.
 */
export function makeUniform(device, data) {
  const arr = data instanceof Float32Array ? data
            : data instanceof Uint32Array  ? data
            : new Float32Array(data);
  const size = Math.max(arr.byteLength, 16);
  const buf  = device.createBuffer({
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buf, 0, arr);
  return buf;
}
