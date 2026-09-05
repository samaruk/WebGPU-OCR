/**
 * Thin dispatch helper: build a bind group from an ordered resource list and
 * dispatch a 2D grid. Keeps the pipeline file readable - every stage becomes a
 * single `run(...)` line instead of 12 lines of bind-group boilerplate.
 */

export class PassRunner {
  /**
   * @param {import('./device.js').GpuContext} ctx
   * @param {import('./buffers.js').ParamsRing} params
   */
  constructor(ctx, params) {
    this.ctx = ctx;
    this.device = ctx.device;
    this.params = params;
    this.encoder = null;
    this.pass = null;
    this.marks = [];
  }

  begin(label = 'gridlift') {
    this.encoder = this.device.createCommandEncoder({ label });
    this.pass = this.encoder.beginComputePass({ label });
    return this;
  }

  /**
   * @param {string} label      shader cache key
   * @param {string} code       WGSL source
   * @param {object} paramsObj  uniform values (see ParamsRing.write)
   * @param {Array<GPUBuffer|GPUTextureView|GPUSampler>} resources bindings 1..n
   * @param {{x:number,y:number,wgx?:number,wgy?:number,entry?:string}} grid
   */
  run(label, code, paramsObj, resources, grid) {
    const pipeline = this.ctx.computePipeline(label, code, grid.entry ?? 'main');
    const uniform = this.params.write(paramsObj);

    const entries = [{ binding: 0, resource: { buffer: uniform } }];
    resources.forEach((r, i) => {
      entries.push({
        binding: i + 1,
        resource: r instanceof GPUBuffer ? { buffer: r } : r,
      });
    });

    const bindGroup = this.device.createBindGroup({
      label,
      layout: pipeline.getBindGroupLayout(0),
      entries,
    });

    const wgx = grid.wgx ?? 8;
    const wgy = grid.wgy ?? 8;
    this.pass.setPipeline(pipeline);
    this.pass.setBindGroup(0, bindGroup);
    this.pass.dispatchWorkgroups(
      Math.ceil(grid.x / wgx),
      Math.ceil(Math.max(1, grid.y ?? 1) / wgy),
      1,
    );
    return this;
  }

  /** 1D convenience (fills, compaction, reductions). */
  run1D(label, code, paramsObj, resources, count, wg = 256, entry = 'main') {
    return this.run(label, code, paramsObj, resources, {
      x: count,
      y: 1,
      wgx: wg,
      wgy: 1,
      entry,
    });
  }

  end() {
    this.pass.end();
    this.device.queue.submit([this.encoder.finish()]);
    this.pass = null;
    this.encoder = null;
    return this;
  }

  /**
   * Close the current pass, submit, and open a fresh one. Needed wherever a
   * later kernel must observe the *completed* writes of an earlier one across a
   * dependency the driver cannot see through a single pass (our CCA iteration
   * relies on this).
   */
  flush(label = 'gridlift') {
    this.end();
    return this.begin(label);
  }
}

/** Wall-clock stage timer. GPU timestamps are optional and often unavailable. */
export class StageLog {
  constructor() {
    this.stages = [];
    this._t0 = 0;
  }
  start(id, name) {
    this._t0 = performance.now();
    this._cur = { id, name };
  }
  stop(extra = {}) {
    if (!this._cur) return;
    this.stages.push({
      ...this._cur,
      ms: +(performance.now() - this._t0).toFixed(2),
      ...extra,
    });
    this._cur = null;
  }
  get totalMs() {
    return +this.stages.reduce((a, s) => a + s.ms, 0).toFixed(2);
  }
}
