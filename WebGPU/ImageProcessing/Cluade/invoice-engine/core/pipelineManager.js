// core/pipelineManager.js — Compile and cache compute/render pipelines

export class PipelineManager {
  constructor(ctx) {
    this.ctx = ctx;
    this._cache = new Map();
  }

  /** Compile a compute pipeline from WGSL source */
  async computePipeline(label, wgslSource, entryPoint = 'main') {
    const key = label;
    if (this._cache.has(key)) return this._cache.get(key);

    const module = this.ctx.device.createShaderModule({ label, code: wgslSource });
    const pipeline = await this.ctx.device.createComputePipelineAsync({
      label,
      layout: 'auto',
      compute: { module, entryPoint },
    });
    this._cache.set(key, pipeline);
    return pipeline;
  }

  /** Dispatch a compute pipeline with a bind group */
  dispatch(encoder, pipeline, bindGroup, wx, wy = 1, wz = 1) {
    const pass = encoder.beginComputePass({ label: pipeline.label });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(wx, wy, wz);
    pass.end();
  }

  /** Helper: create bind group from layout + entries */
  bindGroup(pipeline, entries, groupIndex = 0) {
    return this.ctx.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(groupIndex),
      entries,
    });
  }
}
