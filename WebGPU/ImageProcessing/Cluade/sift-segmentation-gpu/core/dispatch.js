/**
 * core/dispatch.js – workgroup dispatch helpers.
 */
export const dispatchSize2D = (w, h, wx = 8, wy = 8) => ({ x: Math.ceil(w / wx), y: Math.ceil(h / wy), z: 1 });
export const dispatchSize1D = (n, wg = 64) => ({ x: Math.ceil(n / wg), y: 1, z: 1 });

export function runCompute(device, pipeline, bindGroup, dispatch, encoder = null) {
  const enc  = encoder ?? device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
  pass.end();
  if (!encoder) device.queue.submit([enc.finish()]);
  return enc;
}

export function makeBindGroup(device, layout, resources) {
  return device.createBindGroup({
    layout,
    entries: resources.map((res, binding) => {
      if (res instanceof GPUBuffer)  return { binding, resource: { buffer: res } };
      if (res instanceof GPUSampler) return { binding, resource: res };
      return { binding, resource: res };
    }),
  });
}
