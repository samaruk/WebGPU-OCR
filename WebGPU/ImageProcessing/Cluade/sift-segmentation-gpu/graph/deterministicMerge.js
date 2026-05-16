/**
 * graph/deterministicMerge.js – greedy deterministic graph merge.
 * At each iteration merges the highest-scoring edge above the threshold.
 */
export class DeterministicMerge {
  #cfg;
  constructor(cfg) { this.#cfg = cfg; }

  merge(graph, threshold) {
    let { nodes, edges } = structuredClone(graph);
    const { maxMergeRounds } = this.#cfg;

    for (let round = 0; round < maxMergeRounds; round++) {
      // Sort edges by score descending
      edges.sort((a, b) => b.score - a.score);
      const top = edges[0];
      if (!top || top.score < threshold) break;

      const ai = top.a, bi = top.b;
      const na = nodes[ai], nb = nodes[bi];

      // Merge nb into na
      const merged = {
        id:     na.id,
        area:   (na.area ?? 0) + (nb.area ?? 0),
        cx:     Math.round((na.cx + nb.cx) / 2),
        cy:     Math.round((na.cy + nb.cy) / 2),
        bbox:   [
          Math.min(na.bbox?.[0] ?? na.cx, nb.bbox?.[0] ?? nb.cx),
          Math.min(na.bbox?.[1] ?? na.cy, nb.bbox?.[1] ?? nb.cy),
          Math.max(na.bbox?.[2] ?? na.cx, nb.bbox?.[2] ?? nb.cx),
          Math.max(na.bbox?.[3] ?? na.cy, nb.bbox?.[3] ?? nb.cy),
        ],
        meanR:  ((na.meanR ?? 128) + (nb.meanR ?? 128)) / 2,
        meanG:  ((na.meanG ?? 128) + (nb.meanG ?? 128)) / 2,
        meanB:  ((na.meanB ?? 128) + (nb.meanB ?? 128)) / 2,
        compactness: ((na.compactness ?? 0.5) + (nb.compactness ?? 0.5)) / 2,
      };
      nodes[ai] = merged;
      nodes[bi] = null;

      // Redirect edges
      edges = edges
        .filter(e => !(e.a === ai && e.b === bi) && !(e.a === bi && e.b === ai))
        .map(e => {
          if (e.a === bi) return { ...e, a: ai };
          if (e.b === bi) return { ...e, b: ai };
          return e;
        })
        .filter(e => e.a !== e.b);
    }

    const validNodes = nodes.filter(Boolean);
    const nodeRemap  = new Map();
    nodes.forEach((n, i) => { if (n) nodeRemap.set(i, nodeRemap.size); });

    return {
      nodes: validNodes,
      edges: edges
        .filter(e => nodes[e.a] && nodes[e.b])
        .map(e => ({ a: nodeRemap.get(e.a), b: nodeRemap.get(e.b), score: e.score, sharedPixels: e.sharedPixels })),
    };
  }
}
