
import { initializeGPU } from './core/gpuContext.js';
import { PipelineOrchestrator } from './core/pipelineOrchestrator.js';

(async () => {
    const gpu = await initializeGPU();
    const pipeline = new PipelineOrchestrator(gpu);
    await pipeline.run();
})();
