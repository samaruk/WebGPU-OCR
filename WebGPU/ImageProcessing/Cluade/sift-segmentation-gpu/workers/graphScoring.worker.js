/**
 * workers/graphScoring.worker.js
 * Computes merge and split scores for graph edges in a Worker thread.
 */
import { MergeScoring } from '../graph/mergeScoring.js';
import { SplitScoring } from '../graph/splitScoring.js';

self.onmessage = function ({ data }) {
  const { type } = data;
  if (type === 'scoreEdges') {
    const { nodes, edges, keypoints } = data;
    const scored = edges.map(e => ({
      ...e,
      score: MergeScoring.score(nodes[e.a], nodes[e.b], keypoints),
    }));
    self.postMessage({ type: 'scoredEdges', edges: scored });
  }
  if (type === 'scoreSplits') {
    const { nodes, keypoints } = data;
    const scored = nodes.map(n => ({
      id:    n.id,
      score: SplitScoring.score(n, keypoints),
    }));
    self.postMessage({ type: 'scoredSplits', splits: scored });
  }
};
