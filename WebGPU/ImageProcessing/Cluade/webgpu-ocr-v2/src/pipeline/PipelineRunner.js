// Executes stages in topological order, emitting events per stage
import { EVENTS } from "./EventBus.js";

export class PipelineRunner {
  constructor(registry, bus) {
    this.registry = registry;
    this.bus      = bus;
  }

  async run(context) {
    const order = this.registry.topoSort();
    this.bus.emit(EVENTS.PIPELINE_START, { stageCount: order.length });

    const t0 = performance.now();
    let gpuMs = 0;

    for (const id of order) {
      const stage = this.registry.get(id);
      if (!stage?.enabled) continue;

      this.bus.emit(EVENTS.STAGE_START, { id, label: stage.label });
      const stageT0 = performance.now();

      try {
        await stage.execute({ ...context, stageId: id });
        const ms = performance.now() - stageT0;
        gpuMs += context.data[`${id}_gpuMs`] ?? 0;
        this.bus.emit(EVENTS.STAGE_DONE, { id, label: stage.label, ms });
      } catch (err) {
        this.bus.emit(EVENTS.STAGE_ERROR, { id, label: stage.label, error: err });
        throw err;
      }
    }

    const totalMs = performance.now() - t0;
    this.bus.emit(EVENTS.PIPELINE_DONE, { totalMs, gpuMs, data: context.data });
    return context.data;
  }
}