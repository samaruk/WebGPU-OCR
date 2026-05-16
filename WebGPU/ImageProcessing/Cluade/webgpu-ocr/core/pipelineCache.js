// Cache for compiled compute pipelines

const _pipelines = new Map();

/**
 * Get or compile a compute pipeline.
 * @param {GPUDevice} device
 * @param {string}   key    - unique name / hash
 * @param {string}   code   - WGSL source
 * @param {string}   [entry='main']
 * @param {GPUPipelineLayout|'auto'} [layout='auto']
 */
export async function getComputePipeline(device, key, code, entry = 'main', layout = 'auto') {
  if (_pipelines.has(key)) return _pipelines.get(key);

  const module = device.createShaderModule({ code, label: key });

  // Surface shader compilation errors
  const info = await module.getCompilationInfo();
  for (const msg of info.messages) {
    if (msg.type === 'error') {
      console.error(`[PipelineCache] Shader error in ${key} @${msg.lineNum}:${msg.linePos}: ${msg.message}`);
    }
  }

  const pipeline = await device.createComputePipelineAsync({
    layout,
    compute: { module, entryPoint: entry },
    label: key,
  });

  _pipelines.set(key, pipeline);
  return pipeline;
}

export function clearPipelineCache() { _pipelines.clear(); }
export function cacheSize()          { return _pipelines.size; }
