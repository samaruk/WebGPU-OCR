// core/pipelineCache.js – Compile and cache WebGPU compute pipelines

export class PipelineCache {
  /** @param {GPUDevice} device */
  constructor(device) {
    this.device = device;
    this._cache = new Map();   // key → {pipeline, layout, bgLayouts}
  }

  /**
   * Get or create a compute pipeline.
   * @param {string}        key      - unique cache key
   * @param {string}        wgsl     - WGSL shader source
   * @param {string}        entryPoint - compute entry function name
   * @param {Array}         bindGroupLayouts - array of GPUBindGroupLayoutDescriptors
   */
  async get(key, wgsl, entryPoint = 'main', bindGroupLayouts = null) {
    if (this._cache.has(key)) return this._cache.get(key);

    // Compile shader module
    const module = this.device.createShaderModule({
      label: key + '_shader',
      code:  wgsl,
    });

    // Check for compilation errors (best effort)
    const info = await module.getCompilationInfo().catch(() => null);
    if (info) {
      const errors = info.messages.filter(m => m.type === 'error');
      if (errors.length) {
        console.error(`[PipelineCache] Shader "${key}" compilation errors:`);
        errors.forEach(e => console.error(`  Line ${e.lineNum}: ${e.message}`));
        throw new Error(`Shader compilation failed: ${key}`);
      }
    }

    // Build pipeline layout
    let layout = 'auto';
    let resolvedBgLayouts = null;
    if (bindGroupLayouts) {
      resolvedBgLayouts = bindGroupLayouts.map((desc, i) =>
        this.device.createBindGroupLayout({ label: `${key}_bgl_${i}`, ...desc })
      );
      layout = this.device.createPipelineLayout({
        label: key + '_layout',
        bindGroupLayouts: resolvedBgLayouts,
      });
    }

    const pipeline = await this.device.createComputePipelineAsync({
      label:   key + '_pipeline',
      layout,
      compute: { module, entryPoint },
    });

    const entry = { pipeline, bgLayouts: resolvedBgLayouts };
    this._cache.set(key, entry);
    return entry;
  }

  /**
   * Convenience: dispatch a compute pass with a single bind group.
   */
  dispatch(encoder, pipeline, bindGroup, wx, wy = 1, wz = 1) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(wx, wy, wz);
    pass.end();
  }

  /**
   * Convenience: dispatch with multiple bind groups.
   */
  dispatchMulti(encoder, pipeline, bindGroups, wx, wy = 1, wz = 1) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    bindGroups.forEach((bg, i) => pass.setBindGroup(i, bg));
    pass.dispatchWorkgroups(wx, wy, wz);
    pass.end();
  }

  clear() {
    this._cache.clear();
  }
}
