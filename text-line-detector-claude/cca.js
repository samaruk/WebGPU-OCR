/**
 * cca.js — Connected Component Analysis using union-find.
 *
 * WHY THIS FILE EXISTS:
 *   After morphological dilation we have a binary image where each text line
 *   is one connected blob. CCA labels each blob with a unique integer, then
 *   returns per-blob statistics (bounds, area) and a per-pixel label map.
 *
 * WHY UNION-FIND (not BFS/DFS):
 *   BFS requires a queue and visited array — O(N) time but with large constant.
 *   Union-Find processes the image in a single left-to-right top-to-bottom scan,
 *   merging labels on the fly using path-compressed union operations.
 *   Result: O(N α(N)) ≈ O(N) with very small constants, cache-friendly access.
 *
 * WHY 4-CONNECTIVITY (not 8):
 *   8-connectivity causes diagonally-adjacent blobs to merge even when they
 *   only touch at a corner. For dilated text line blobs this would merge
 *   nearby lines that touch diagonally at one pixel. 4-connectivity is strict
 *   enough that blobs must share an edge to be considered connected.
 *
 * WHY labelMap IS RETURNED:
 *   The skeleton graph processing needs to isolate skeleton pixels to exactly
 *   one CCA component. Without a per-pixel label map, we'd have to rely on
 *   bounding-box proximity (which fails when two lines' boxes overlap).
 *   labelMap[i] = resolved label of pixel i guarantees exact membership.
 */

/**
 * Run 4-connected CCA on a float32 binary image.
 *
 * @param {Float32Array} bin   - Binary image: 1=foreground, 0=background
 * @param {number} W           - Image width
 * @param {number} H           - Image height
 * @returns {{
 *   components: Array<{minX,maxX,minY,maxY,area,label}>,
 *   labelMap:   Int32Array   — labelMap[y*W+x] = resolved label (-1 if background)
 * }}
 */
export function cca(bin, W, H) {
  const lbl = new Int32Array(W * H).fill(-1);
  const par = [];

  // Path-compressed find — flattens the union-find tree for near-O(1) lookup.
  const find = x => {
    while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; }
    return x;
  };

  // Union by label (not rank) — simple and sufficient for this use case.
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };

  let next = 0;

  // ── First pass: assign provisional labels and union adjacent foreground pixels
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (bin[y * W + x] < 0.5) continue;

      // Check the two already-processed 4-neighbours (up and left)
      const up = (y > 0 && bin[(y - 1) * W + x] > 0.5) ? lbl[(y - 1) * W + x] : -1;
      const lt = (x > 0 && bin[y * W + x - 1] > 0.5) ? lbl[y * W + x - 1] : -1;

      if (up < 0 && lt < 0) {
        par.push(next);
        lbl[y * W + x] = next++;
      } else if (up >= 0 && lt < 0) {
        lbl[y * W + x] = find(up);
      } else if (lt >= 0 && up < 0) {
        lbl[y * W + x] = find(lt);
      } else {
        unite(up, lt);
        lbl[y * W + x] = find(up);
      }
    }
  }

  // ── Second pass: resolve labels and accumulate component metadata
  const map = new Map();
  const labelMap = new Int32Array(W * H).fill(-1);

  for (let i = 0; i < lbl.length; i++) {
    if (lbl[i] < 0) continue;
    const l = find(lbl[i]);
    const x = i % W, y = (i / W) | 0;
    labelMap[i] = l;

    if (!map.has(l)) {
      map.set(l, { minX: x, maxX: x, minY: y, maxY: y, area: 0, label: l });
    }
    const c = map.get(l);
    if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x;
    if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y;
    c.area++;
  }

  return { components: [...map.values()], labelMap };
}
