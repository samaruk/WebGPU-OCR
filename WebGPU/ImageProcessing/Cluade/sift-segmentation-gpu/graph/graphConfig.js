/**
 * graph/graphConfig.js – graph algorithm tunables.
 */
export const GRAPH_DEFAULTS = {
  maxMergeRounds:   8,
  splitEnabled:     true,
  splitScoreThresh: 0.55,
  minEdgePixels:    2,   // minimum shared-pixel count to form an edge
};
