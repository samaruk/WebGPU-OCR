/**
 * graph.js — Skeleton graph: build, prune, connected components, longest path.
 *
 * WHY THIS FILE EXISTS:
 *   The Zhang-Suen skeleton is a set of 1-pixel-wide curves stored in a flat
 *   array. To find the main axis of a text line we need graph algorithms:
 *     1. Build adjacency from the 8-connected skeleton pixels.
 *     2. Prune short spike branches left by ZS at character junctions.
 *     3. Find connected components (to handle split skeleton pieces).
 *     4. Find the longest path (graph diameter) via 2-sweep BFS — this gives
 *        the true start-to-end extent of the text line.
 *
 * WHY GRAPH DIAMETER (2-SWEEP BFS) FOR LONGEST PATH:
 *   Greedy walk: start at any point, follow nearest unvisited neighbour.
 *   Problem: at a T-junction it takes the wrong branch and stops too early.
 *   2-sweep BFS: (1) BFS from any node → farthest node A.
 *                (2) BFS from A → farthest node B.
 *   Path A→B is provably the graph diameter (longest path in a tree/near-tree).
 *   This always finds the true line extent regardless of topology.
 *
 * WHY PER-CCA-COMPONENT LOCAL GRAPHS:
 *   A global skeleton graph can connect two adjacent line blobs if their
 *   dilated regions touch at even one pixel — the skeleton edge crosses the
 *   blob boundary. One graphComponents() call would then classify two lines as
 *   one component, and buildMinRect would wrap both in a single OBB.
 *   Solution: build a local graph per CCA component filtered by dilLabelMap,
 *   so edges that cross component boundaries are never added.
 */

/**
 * Build an 8-connected adjacency map from skeleton pixels in a region,
 * filtered to a single CCA label.
 *
 * @param {Float32Array} skelData  - Skeleton binary (1=skeleton, 0=background)
 * @param {Int32Array}   labelMap  - Per-pixel CCA label from cca()
 * @param {number}       label     - Only include pixels with this label
 * @param {number}       x0,y0,x1,y1 - Bounding box to scan (inclusive)
 * @param {number}       W, H      - Image dimensions
 * @returns {Map<number, Set<number>>}  pixelIdx → Set of neighbour pixelIdxs
 */
export function buildLocalGraph(skelData, labelMap, label, x0, y0, x1, y1, W, H) {
  const nodes = new Map();

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (skelData[y * W + x] < 0.5) continue;
      // WHY labelMap CHECK: prevents skeleton edges from crossing into an
      // adjacent CCA component, which would merge two line paths into one.
      if (labelMap[y * W + x] !== label) continue;

      const idx = y * W + x;
      const nb = new Set();

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
          if (skelData[ny * W + nx] > 0.5 && labelMap[ny * W + nx] === label)
            nb.add(ny * W + nx);
        }
      }
      nodes.set(idx, nb);
    }
  }
  return nodes;
}

/**
 * Iteratively prune branches shorter than minLen pixels.
 *
 * WHY NEEDED:
 *   Zhang-Suen leaves short spikes at T/Y junctions where character strokes
 *   meet. These spikes are degree-1 endpoints whose paths dead-end quickly.
 *   If not removed, the 2-sweep BFS might start at a spike tip and find another
 *   spike as the "farthest" point, producing a short spike-to-spike diameter
 *   rather than the full line extent.
 *
 * ALGORITHM:
 *   Find a degree-1 node (one live neighbour). Trace from it until a junction
 *   or another endpoint. If the traced branch is shorter than minLen, delete
 *   all its nodes (except the junction). Restart until no more short branches.
 *   O(nodes * minLen) per restart — fast for small minLen values.
 *
 * @param {Map} nodes   - Adjacency map (mutated in place)
 * @param {number} W    - Image width (used only for index arithmetic)
 * @param {number} minLen - Delete branches shorter than this many pixels
 */
export function pruneGraph(nodes, W, minLen) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [idx] of nodes) {
      const live = [...nodes.get(idx)].filter(n => nodes.has(n));
      if (live.length !== 1) continue; // not an endpoint

      // Trace the branch from this endpoint to its junction or other endpoint
      const branch = [idx];
      let prev = -1, cur = idx;
      while (branch.length <= minLen) {
        const fwd = [...nodes.get(cur)].filter(n => nodes.has(n) && n !== prev);
        if (fwd.length !== 1) break; // junction or dead end
        prev = cur; cur = fwd[0]; branch.push(cur);
      }

      if (branch.length <= minLen) {
        // Remove all branch nodes except the junction at the end
        const last = branch[branch.length - 1];
        const lastLive = [...nodes.get(last)].filter(n => nodes.has(n));
        const stop = lastLive.length > 1 ? branch.length - 1 : branch.length;
        for (let i = 0; i < stop; i++) nodes.delete(branch[i]);
        changed = true;
        break; // restart: map was mutated during iteration
      }
    }
  }
}

/**
 * Find all connected components of the graph via BFS.
 *
 * WHY NEEDED:
 *   After pruning, a single CCA blob's skeleton may have disconnected pieces
 *   (e.g., a word separated from the rest by a wide gap that dilation didn't
 *   fully bridge). We process each piece independently and take the longest.
 *
 * @param {Map} nodes
 * @returns {Array<Set<number>>}  Array of pixel-index sets, one per component
 */
export function graphComponents(nodes) {
  const visited = new Set();
  const comps = [];

  for (const idx of nodes.keys()) {
    if (visited.has(idx)) continue;
    const comp = new Set();
    const queue = [idx];
    visited.add(idx); comp.add(idx);

    while (queue.length) {
      const cur = queue.shift();
      for (const nb of nodes.get(cur)) {
        if (!nodes.has(nb) || visited.has(nb)) continue;
        visited.add(nb); comp.add(nb); queue.push(nb);
      }
    }
    comps.push(comp);
  }
  return comps;
}

/**
 * Find the longest path (diameter) in a graph component using 2-sweep BFS.
 *
 * WHY 2-SWEEP BFS GIVES THE DIAMETER:
 *   Theorem: In a tree, the farthest node from any starting node is always one
 *   endpoint of a diameter path. So: BFS(any) → A (first endpoint),
 *   BFS(A) → B (second endpoint). Path A→B is the diameter.
 *   Zhang-Suen skeletons are not perfect trees (junctions create cycles) but
 *   the algorithm still finds the dominant long path through the graph.
 *
 * @param {Map}         nodes - Adjacency map
 * @param {Set<number>} comp  - Pixel indices in this component
 * @param {number}      W     - Image width (for index → (x,y) conversion)
 * @returns {Array<{x:number,y:number}>}  Ordered points from one end to the other
 */
export function longestPath(nodes, comp, W) {
  const bfs = startIdx => {
    const dist = new Map([[startIdx, 0]]);
    const prev = new Map([[startIdx, -1]]);
    const queue = [startIdx];
    let far = startIdx, maxD = 0;

    while (queue.length) {
      const cur = queue.shift();
      for (const nb of nodes.get(cur)) {
        if (!nodes.has(nb) || dist.has(nb)) continue;
        const d = dist.get(cur) + 1;
        dist.set(nb, d); prev.set(nb, cur); queue.push(nb);
        if (d > maxD) { maxD = d; far = nb; }
      }
    }
    return { far, prev };
  };

  const r1 = bfs([...comp][0]);   // sweep 1: find endpoint A
  const r2 = bfs(r1.far);          // sweep 2: find endpoint B from A

  // Reconstruct the path from B back to A by following prev[] pointers
  const path = [];
  let cur = r2.far;
  while (cur !== -1 && nodes.has(cur)) {
    path.push({ x: cur % W, y: (cur / W) | 0 });
    cur = r2.prev.get(cur) ?? -1;
  }
  return path; // ordered from B to A (left-to-right after canonical axis fix)
}
