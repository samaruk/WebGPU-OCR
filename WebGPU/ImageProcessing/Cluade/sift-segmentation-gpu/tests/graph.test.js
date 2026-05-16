/**
 * tests/graph.test.js – unit tests for graph building and merging.
 */
import { DeterministicMerge } from '../graph/deterministicMerge.js';

describe('DeterministicMerge', () => {
  const cfg = { maxMergeRounds: 4 };
  const merger = new DeterministicMerge(cfg);

  test('merges two highly-similar nodes', () => {
    const graph = {
      nodes: [
        { id: 0, area: 100, cx: 10, cy: 10, bbox: [0,0,20,20], meanR: 128, meanG: 128, meanB: 128, compactness: 0.8 },
        { id: 1, area: 100, cx: 30, cy: 10, bbox: [20,0,40,20], meanR: 130, meanG: 128, meanB: 128, compactness: 0.8 },
      ],
      edges: [{ a: 0, b: 1, score: 0.9, sharedPixels: 20 }],
    };
    const merged = merger.merge(graph, 0.45);
    expect(merged.nodes).toHaveLength(1);
  });

  test('keeps nodes with low-scoring edges', () => {
    const graph = {
      nodes: [
        { id: 0, area: 100, cx: 10, cy: 10, bbox: [0,0,20,20], meanR: 0,   meanG: 0,   meanB: 0,   compactness: 0.5 },
        { id: 1, area: 100, cx: 30, cy: 10, bbox: [20,0,40,20], meanR: 255, meanG: 255, meanB: 255, compactness: 0.5 },
      ],
      edges: [{ a: 0, b: 1, score: 0.1, sharedPixels: 2 }],
    };
    const merged = merger.merge(graph, 0.45);
    expect(merged.nodes).toHaveLength(2);
  });
});
