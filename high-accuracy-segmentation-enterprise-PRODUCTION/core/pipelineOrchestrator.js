
import { StageRegistry } from './stageRegistry.js';
import { Profiler } from './profiler.js';

export class PipelineOrchestrator {
    constructor(gpu) {
        this.gpu = gpu;
        this.registry = new StageRegistry(gpu);
        this.profiler = new Profiler();
    }

    async run() {
        const stages = this.registry.getOrderedStages();
        for (const stage of stages) {
            this.profiler.start(stage.name);
            await stage.execute();
            this.profiler.end(stage.name);
        }
        this.profiler.report();
    }
}
