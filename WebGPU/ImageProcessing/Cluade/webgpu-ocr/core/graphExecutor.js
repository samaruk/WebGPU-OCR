// Executes a FrameGraph with progress callbacks

import { FrameGraph } from './frameGraph.js';

export class GraphExecutor {
  /**
   * @param {FrameGraph}   graph
   * @param {Function}     onProgress  (stageId, status, ms?) => void
   */
  constructor(graph, onProgress) {
    this.graph      = graph;
    this.onProgress = onProgress ?? (() => {});
  }

  async run(ctx) {
    const g   = this.graph;
    g.results = {};

    for (const node of g.nodes) {
      this.onProgress(node.id, 'running');
      const t0 = performance.now();
      try {
        const depResults = node.deps.map(d => g.results[d]);
        g.results[node.id] = await node.fn(ctx, ...depResults);
        const ms = performance.now() - t0;
        this.onProgress(node.id, 'done', ms);
      } catch (err) {
        console.error(`[GraphExecutor] Stage ${node.id} failed:`, err);
        this.onProgress(node.id, 'error', 0);
        throw err;
      }
    }
    return g.results;
  }
}
