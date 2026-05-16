/**
 * @file charSeparation.js
 * @description Projection-profile–based separation of touching characters.
 *
 * Problem
 * ───────
 * After binarisation, two or more adjacent characters that share ink pixels
 * are merged into a single connected component by the connected-components
 * pass.  A naïve bounding box would cover the entire fused blob, making
 * downstream OCR or per-character analysis unreliable.
 *
 * Strategy: vertical projection profile valley cuts
 * ─────────────────────────────────────────────────
 * For a horizontal text line, characters are arranged left-to-right.
 * Between neighbouring characters there is typically a gap or a "neck"
 * where the ink is thin.  If we count how many foreground pixels of the
 * component fall in each column (the "vertical projection profile"), those
 * thin inter-character necks appear as valleys in the profile.
 *
 * Steps for each connected component:
 *
 *  1. Build the per-column pixel count (projection profile) using only the
 *     pixels belonging to this component (via the `labels` array).
 *
 *  2. Apply a 3-point moving average to suppress 1-pixel-wide spikes.
 *
 *  3. Find local minima in the smoothed profile.
 *
 *  4. For each minimum, compute its "depth" relative to the nearest peaks
 *     on its left and right (shoulder heights).  A deep valley indicates a
 *     real inter-character gap; a shallow minimum is noise or a serif join.
 *
 *       depth = 1 − profile[valley] / min(leftShoulder, rightShoulder)
 *
 *     Accept the valley as a cut if depth > VALLEY_DEPTH_THRESHOLD.
 *
 *  5. Merge adjacent accepted minima (within 3 columns) into a single cut at
 *     the shallowest point (narrowest neck) of the cluster.
 *
 *  6. For each pair of consecutive cuts, extract a sub-region: scan the pixels
 *     of the original component that fall within the cut's x-range, and
 *     compute a tight vertical bounding box (accurate y1, y2).
 *
 *  7. Recursively apply the procedure to each sub-region (up to MAX_SPLIT_DEPTH)
 *     to handle blobs containing three or more touching characters.
 *
 * Limitations
 * ───────────
 *  • Works best for left-to-right horizontal text.  Vertical text or cursive
 *    scripts with many diagonal connections may produce incorrect cuts.
 *  • Very similar characters (e.g., 'll', 'nn') may not have a visible valley
 *    and will remain merged — this is correct behaviour (no false cut).
 *  • The algorithm cuts at column positions, not along the true ink contour.
 *    Sub-region bounding boxes may therefore overlap by 1–2 pixels at the cut.
 *
 * Public API
 * ──────────
 *  findValleyCuts(proj)                                   → number[]
 *  splitRegionByProjection(binary, labels, region, W, H, minSplitArea)
 *                                                         → Region[] | null
 *  splitAllRegions(binary, labels, regions, W, H, minSplitArea)
 *                                                         → Region[]
 */

import {
  VALLEY_DEPTH_THRESHOLD,
  MIN_SHOULDER_RATIO,
  MAX_SPLIT_DEPTH,
  MIN_SPLIT_WIDTH,
} from './config.js';

// ── PUBLIC API ─────────────────────────────────────────────────────────────────

/**
 * Detect column indices where a touching-character cut should be made, based
 * on valleys in the per-column pixel-count profile.
 *
 * @param {Int32Array|number[]} proj - Per-column foreground pixel count.
 *   proj[i] is the number of pixels in the i-th column of the component's
 *   bounding box that belong to this component.
 *
 * @returns {number[]} Sorted array of column indices (relative to proj[0])
 *   where cuts should be placed.  Empty array if no significant valley found.
 *
 * @example
 * // Profile of two 'i' characters touching at one pixel:
 * // [5, 8, 8, 2, 1, 2, 7, 8, 6]
 * //                 ^-- valley at index 4
 * findValleyCuts([5, 8, 8, 2, 1, 2, 7, 8, 6]);  // → [4]
 */
export function findValleyCuts(proj) {
  const w = proj.length;
  if (w < 4) return [];

  // ── Step 1: 3-point moving-average smoothing ──────────────────────────
  // Suppresses single-pixel spikes caused by thin diagonal strokes (e.g.,
  // the crossbar of 't' touching the next character by one pixel).
  const sm = new Float32Array(w);
  sm[0]   = (proj[0] * 2 + proj[1]) / 3;
  sm[w-1] = (proj[w-2] + proj[w-1] * 2) / 3;
  for (let i = 1; i < w - 1; i++) {
    sm[i] = (proj[i-1] + proj[i] + proj[i+1]) / 3;
  }

  const maxP = Math.max(...sm);
  if (maxP < 2) return [];  // profile too sparse to cut meaningfully

  // ── Step 2: Collect local minima ──────────────────────────────────────
  const cuts = [];

  for (let i = 1; i < w - 1; i++) {
    // Strict local minimum: both neighbours are larger
    if (sm[i] >= sm[i-1] || sm[i] >= sm[i+1]) continue;

    // ── Step 3: Find shoulder heights ──────────────────────────────────
    // Left shoulder: walk left until we find a peak (local maximum or edge)
    let lS = sm[i];
    for (let k = i - 1; k >= 0; k--) {
      if (sm[k] > lS) lS = sm[k];
      // Stop at the first local maximum encountered
      if (k > 0 && sm[k] > sm[k-1] && sm[k] >= sm[k+1]) break;
    }

    // Right shoulder: walk right until we find a peak
    let rS = sm[i];
    for (let k = i + 1; k < w; k++) {
      if (sm[k] > rS) rS = sm[k];
      if (k < w-1 && sm[k] > sm[k+1] && sm[k] >= sm[k-1]) break;
    }

    const shoulder = Math.min(lS, rS);

    // Reject if either shoulder is too small relative to the global maximum
    // (prevents spurious cuts near component edges where the profile tapers)
    if (shoulder < maxP * MIN_SHOULDER_RATIO) continue;

    // ── Step 4: Depth test ───────────────────────────────────────────────
    const depth = 1 - sm[i] / shoulder;  // 0 = flat, 1 = complete gap
    if (depth > VALLEY_DEPTH_THRESHOLD) {
      cuts.push(i);
    }
  }

  if (cuts.length === 0) return [];

  // ── Step 5: Merge nearby minima ───────────────────────────────────────
  // When two accepted minima are within 3 columns, they belong to the same
  // inter-character neck.  Keep the deepest (lowest profile value) one.
  const merged = [];
  let j = 0;
  while (j < cuts.length) {
    let minVal = sm[cuts[j]], minIdx = cuts[j];
    // Absorb consecutive close neighbours into the same cluster
    while (j + 1 < cuts.length && cuts[j+1] - cuts[j] <= 3) {
      j++;
      if (sm[cuts[j]] < minVal) { minVal = sm[cuts[j]]; minIdx = cuts[j]; }
    }
    merged.push(minIdx);
    j++;
  }

  return merged;
}

/**
 * Attempt to split a single connected-component region at vertical valley cuts.
 *
 * @param {Uint32Array}  binary       - Binary foreground mask (1 = ink).
 * @param {Int32Array}   labels       - Per-pixel component id from connectedComponents.
 * @param {import('./connectedComponents.js').Region} region - The region to split.
 * @param {number}       W            - Image width.
 * @param {number}       H            - Image height.
 * @param {number}       minSplitArea - Minimum pixel count for a sub-region to
 *                                      be kept (prevents splitting into slivers).
 *
 * @returns {import('./connectedComponents.js').Region[]|null}
 *   Array of sub-regions if a split was made, or null if no valid cut found.
 *   The returned sub-regions share the same `id` as the parent (they belong to
 *   the same connected component) but have independent bounding boxes.
 */
export function splitRegionByProjection(binary, labels, region, W, H, minSplitArea) {
  const { id, x1, y1, w, h } = region;

  // ── Build per-column pixel count (this component only) ────────────────
  const proj = new Int32Array(w);
  const y2   = Math.min(y1 + h, H);
  const x2   = Math.min(x1 + w, W);

  for (let y = y1; y < y2; y++) {
    const row = y * W;
    for (let x = x1; x < x2; x++) {
      if (labels[row + x] === id) proj[x - x1]++;
    }
  }

  // ── Find cut columns ─────────────────────────────────────────────────
  const cuts = findValleyCuts(proj);
  if (cuts.length === 0) return null;

  // ── Build sub-bounding-boxes ─────────────────────────────────────────
  // bounds[s] and bounds[s+1] are the left and right column edges of segment s
  // relative to x1.  Using −1 / w as sentinels means the first segment
  // starts at column x1 + 0 and the last ends at column x1 + w − 1.
  const bounds = [-1, ...cuts, w];
  const subs   = [];

  for (let s = 0; s < bounds.length - 1; s++) {
    const bx1 = x1 + bounds[s] + 1;   // inclusive left edge
    const bx2 = x1 + bounds[s + 1];   // inclusive right edge

    // Discard slivers that are too narrow to be a real glyph part
    if (bx2 - bx1 < MIN_SPLIT_WIDTH) continue;

    // Compute tight vertical bounds by scanning this column slice
    let sy1 = Infinity, sy2 = -Infinity, n = 0;
    for (let y = y1; y < y2; y++) {
      const row = y * W;
      for (let x = bx1, ex = Math.min(bx2 + 1, W); x < ex; x++) {
        if (labels[row + x] === id) {
          n++;
          if (y < sy1) sy1 = y;
          if (y > sy2) sy2 = y;
        }
      }
    }

    if (n >= minSplitArea && sy1 !== Infinity) {
      subs.push({
        id,
        label:   id,
        x1:      bx1,
        y1:      sy1,
        w:       bx2 - bx1 + 1,
        h:       sy2 - sy1 + 1,
        n,
        isSplit: true,  // flag for downstream consumers
      });
    }
  }

  // Only report a split if we produced at least two valid sub-regions
  return subs.length > 1 ? subs : null;
}

/**
 * Apply `splitRegionByProjection` recursively to every region in the input
 * array, up to MAX_SPLIT_DEPTH levels of recursion per branch.
 *
 * Why recursive?
 * A blob of N touching characters may require N−1 splits.  The first pass
 * might only separate it into two halves, each of which still contains
 * touching characters.  Recursion ensures all of them are eventually resolved.
 *
 * @param {Uint32Array} binary       - Binary foreground mask.
 * @param {Int32Array}  labels       - Per-pixel component ids.
 * @param {import('./connectedComponents.js').Region[]} regions - Input regions.
 * @param {number}      W            - Image width.
 * @param {number}      H            - Image height.
 * @param {number}      minSplitArea - Minimum pixel count per sub-region.
 *
 * @returns {import('./connectedComponents.js').Region[]}
 *   Flat array containing the original regions where no split was found, plus
 *   the deepest-level sub-regions where splits were applied.
 */
export function splitAllRegions(binary, labels, regions, W, H, minSplitArea) {
  const result = [];

  /**
   * Recursively try to split `region`.
   * @param {import('./connectedComponents.js').Region} region
   * @param {number} depth Current recursion depth.
   */
  function rec(region, depth) {
    // Hard depth limit prevents infinite loops on pathological blobs
    if (depth > MAX_SPLIT_DEPTH) {
      result.push(region);
      return;
    }

    const subs = splitRegionByProjection(binary, labels, region, W, H, minSplitArea);

    if (!subs) {
      // No split found — keep the region as-is
      result.push(region);
    } else {
      // Each sub-region may itself contain touching characters — recurse
      for (const sub of subs) rec(sub, depth + 1);
    }
  }

  for (const region of regions) rec(region, 0);
  return result;
}
