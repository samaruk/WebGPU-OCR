// ============================================================
// SIFT-GPU  –  Pipeline Factory
// Compiles and caches compute pipelines from WGSL source.
// ============================================================

const _cache = new Map();

/**
 * Create (or retrieve from cache) a GPUComputePipeline.
 *
 * @param {GPUDevice}  device
 * @param {string}     wgslSource  - shader source text
 * @param {string}     entryPoint  - @compute entry function name
 * @param {string}     [label]
 * @returns {GPUComputePipeline}
 */
export function getPipeline(device, wgslSource, entryPoint = 'main', label = '') {
  const key = wgslSource + entryPoint;
  if (_cache.has(key)) return _cache.get(key);

  const module = device.createShaderModule({
    label:  label || entryPoint,
    code:   wgslSource,
  });

  const pipeline = device.createComputePipeline({
    label,
    layout:  'auto',
    compute: { module, entryPoint },
  });

  _cache.set(key, pipeline);
  return pipeline;
}

/**
 * Convenience: build a bind group from an ordered list of resources.
 * Each entry is { buffer } | { texture } | { storageTexture }.
 */
export function makeBindGroup(device, pipeline, groupIndex, entries) {
  const bgEntries = entries.map((e, i) => {
    if (e.buffer) {
      return { binding: i, resource: { buffer: e.buffer, offset: e.offset ?? 0, size: e.size } };
    }
    if (e.textureView) {
      return { binding: i, resource: e.textureView };
    }
    throw new Error(`Unknown bind-group entry type at index ${i}`);
  });

  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(groupIndex),
    entries: bgEntries,
  });
}

/** Clear the pipeline cache (call when device is recreated). */
export function clearPipelineCache() {
  _cache.clear();
}
