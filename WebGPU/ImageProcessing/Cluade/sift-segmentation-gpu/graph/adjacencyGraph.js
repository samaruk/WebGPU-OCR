/**
 * graph/adjacencyGraph.js – sparse adjacency graph between CCA components.
 */
export class AdjacencyGraph {
  /**
   * Build adjacency from the label map — two components are adjacent if
   * they share a pixel border within `borderPixels`.
   */
  static build(ccaResult, borderPixels = 1) {
    const { labels, components, width: W, height: H } = ccaResult;
    const edgeSet = new Map(); // "a:b" → count

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const la = labels[y * W + x];
        if (la < 0) continue;
        // Check right and down neighbours
        for (const [nx, ny] of [[x+1,y],[x,y+1]]) {
          if (nx >= W || ny >= H) continue;
          const lb = labels[ny * W + nx];
          if (lb < 0 || lb === la) continue;
          const key = la < lb ? `${la}:${lb}` : `${lb}:${la}`;
          edgeSet.set(key, (edgeSet.get(key) ?? 0) + 1);
        }
      }
    }

    const nodeMap = new Map(components.map((c, i) => [c.id, i]));
    const nodes   = components.map(c => ({ ...c }));
    const edges   = [];
    for (const [key, count] of edgeSet) {
      const [a, b] = key.split(':').map(Number);
      if (!nodeMap.has(a) || !nodeMap.has(b)) continue;
      edges.push({ a: nodeMap.get(a), b: nodeMap.get(b), sharedPixels: count, score: 0 });
    }

    return { nodes, edges };
  }
}
