/**
 * graph/graphBuilder.js – enriches adjacency graph with keypoint-derived edge scores.
 */
import { AdjacencyGraph }    from './adjacencyGraph.js';
import { MergeScoring }      from './mergeScoring.js';

export class GraphBuilder {
  #cfg;
  constructor(cfg) { this.#cfg = cfg; }

  build(ccaResult, keypoints) {
    const graph = AdjacencyGraph.build(ccaResult);
    // Assign merge scores
    for (const edge of graph.edges) {
      edge.score = MergeScoring.score(graph.nodes[edge.a], graph.nodes[edge.b], keypoints);
    }
    return graph;
  }
}
