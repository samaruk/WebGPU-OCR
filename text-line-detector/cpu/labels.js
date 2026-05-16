/**
 * cpu/labels.js — CPU-side label compaction after GPU parallel union-find.
 *
 * WHY NECESSARY:
 *   After the GPU CCA stages, parentArr[i] holds the "root" pixel index for each
 *   foreground pixel. Roots are arbitrary pixel indices in [0, W×H), not a contiguous
 *   range. The GPU stats shader needs compact labels in [0, K) to index into a per-
 *   component stats array of exactly K × 3 elements. Without compaction:
 *     • The stats buffer would need W×H slots (up to 16 M u32s = 64 MB for a 4 K image)
 *       instead of K × 3 slots (typically < 1 KB for an invoice page).
 *     • The stats accumulation shader would waste memory bandwidth reading and writing
 *       mostly-empty slots.
 *
 * WHY CPU (not GPU) FOR COMPACTION:
 *   Building a compact root→index mapping requires a global unique-count of distinct roots,
 *   which is equivalent to a GPU stream compaction (radix sort + prefix scan). That is an
 *   expensive multi-pass GPU operation. Since parentArr is already read back to CPU for the
 *   polyline extraction path, doing compaction on the CPU is free in terms of extra data
 *   transfer — the array is already in CPU memory.
 *
 * COMPLEXITY: O(N × α(N)) ≈ O(N) with path-halving, where N = W×H.
 */

/**
 * compactLabels — Remap GPU union-find roots to sequential component indices.
 *
 * WHY PATH-HALVING ON CPU (find function):
 *   The GPU COMPRESS shader runs a bounded number of iterations (16 inner loops), so
 *   after 30 CCA cycles some parent chains may still have 2–3 hops to their root.
 *   Running one additional round of CPU path-halving ensures every pixel directly points
 *   to its root before we hash roots to indices. Without this, two pixels in the same
 *   component might find different intermediate nodes as "root", causing them to be
 *   assigned different labels — incorrectly splitting one component into two.
 *
 * WHY MUTATING parentArr IN-PLACE (path-halving side-effect):
 *   parentArr is a local Uint32Array returned by readbackU32; it is not shared with any
 *   other consumer. Mutating it during compaction is safe and avoids allocating a second
 *   copy of a potentially large array (4 MB for a 1000×1000 image).
 *
 * @param {Uint32Array} parentArr — GPU union-find result (mutated in-place by path compression)
 * @param {number}      N         — total pixel count (W × H)
 * @returns {{ labelArr: Uint32Array, K: number }}
 *   labelArr[i] ∈ [0, K) for foreground pixels; 0xFFFFFFFF for background.
 *   K = number of distinct connected components found.
 */
export function compactLabels(parentArr, N) {
  const labelArr = new Uint32Array(N).fill(0xFFFFFFFF);
  const rootMap  = new Map();
  let K = 0;

  // Path-halving find: follow chain with concurrent shortcutting.
  // Stops when parent[x] == x (root found) or parent[x] == 0xFFFFFFFF (background).
  const find = (start) => {
    let x = start;
    for (let k = 0; k < 128; k++) {
      const p = parentArr[x];
      if (p === 0xFFFFFFFF || p === x) return p;
      // Path-halving: point x directly to grandparent, then follow grandparent.
      const pp = parentArr[p];
      parentArr[x] = pp;
      x = pp;
    }
    return parentArr[x];
  };

  for (let i = 0; i < N; i++) {
    if (parentArr[i] === 0xFFFFFFFF) continue; // background pixel — skip
    const r = find(i);
    if (r === 0xFFFFFFFF) continue;            // disconnected from any root — skip
    if (!rootMap.has(r)) rootMap.set(r, K++);
    labelArr[i] = rootMap.get(r);
  }

  return { labelArr, K };
}
