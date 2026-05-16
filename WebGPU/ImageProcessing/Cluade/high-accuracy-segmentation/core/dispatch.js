/**
 * core/dispatch.js - Centralized workgroup dispatch helpers.
 */
export function dispatchSize(dim, workgroupSize) {
  return Math.ceil(dim / workgroupSize);
}

export function dispatch2D(encoder, pipeline, bindGroup, width, height, wgX = 8, wgY = 8) {
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatchSize(width, wgX), dispatchSize(height, wgY));
  pass.end();
}

export function dispatch1D(encoder, pipeline, bindGroup, count, wgSize = 64) {
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatchSize(count, wgSize));
  pass.end();
}
