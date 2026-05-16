/**
 * @file charFilter.js
 * @description Heuristic filter that separates character glyphs from non-character
 * artefacts (lines, borders, ink blobs, noise patches) in the bounding-box output.
 *
 * Problem
 * ───────
 * After Sauvola binarisation + connected-components labelling, the foreground
 * mask contains not only ink characters but also:
 *
 *  • Horizontal and vertical rules / table borders
 *  • Long thin underlines and strikethroughs
 *  • Large filled boxes or photo regions
 *  • Isolated noise dots and speckles
 *  • Page-edge shadows or binding bleed-through
 *
 * Drawing bounding boxes around these produces cluttered output and misleads
 * downstream OCR engines.  `isCharacterLike` applies five independent geometric
 * tests that together reject the vast majority of non-glyph regions with very
 * few false negatives on normal document text.
 *
 * Heuristics (applied in order, short-circuit on first failure)
 * ─────────────────────────────────────────────────────────────
 *
 *  1. Minimum dimension
 *     min(w, h) < MIN_CHAR_DIM → reject
 *     Catches hairlines that are only 1–2 pixels thick.
 *
 *  2. Hard aspect ratio ceiling
 *     aspect = max(w,h) / min(w,h) > MAX_CHAR_ASPECT → reject
 *     A thin horizontal rule of 400×2 px has aspect = 200.
 *     The widest single characters (e.g. 'W', 'M') rarely exceed aspect ≈ 3–4.
 *
 *  3. Moderate-aspect + low-density secondary test
 *     aspect > MODERATE_ASPECT AND density < MIN_LINE_DENSITY → reject
 *     Catches dashed lines and light separator strokes that pass test 2 but
 *     have very few actual ink pixels relative to their bounding box.
 *
 *  4. Fill density bounds
 *     density = n / (w × h)
 *     density < FILL_DENSITY_MIN → reject  (too sparse: isolated dots)
 *     density > FILL_DENSITY_MAX → reject  (too solid: filled block / ink bleed)
 *
 *  5. Maximum fraction of image area
 *     (w × h) / (imgW × imgH) > MAX_CHAR_IMAGE_FRACTION → reject
 *     A border or photo region that covers more than 4% of the image cannot
 *     be a single printable glyph.
 *
 * Tuning
 * ──────
 * All threshold values are defined in config.js and can be adjusted without
 * touching this file.  If real glyphs are being incorrectly rejected:
 *  • Increase MAX_CHAR_ASPECT (for tall narrow scripts like 'l', '|')
 *  • Decrease FILL_DENSITY_MIN (for very thin serif strokes)
 *  • Decrease VALLEY_DEPTH_THRESHOLD in charSeparation.js (more splits)
 *
 * Public API
 * ──────────
 *  isCharacterLike(region, imgW, imgH) → boolean
 */

import {
  MIN_CHAR_DIM,
  MAX_CHAR_ASPECT,
  MODERATE_ASPECT,
  MIN_LINE_DENSITY,
  FILL_DENSITY_MIN,
  FILL_DENSITY_MAX,
  MAX_CHAR_IMAGE_FRACTION,
} from './config.js';

// ── PUBLIC API ─────────────────────────────────────────────────────────────────

/**
 * Determine whether a bounding-box region looks like a printable character glyph.
 *
 * @param {import('./connectedComponents.js').Region} r - Region to evaluate.
 * @param {number} imgW - Full image width in pixels (for image-fraction test).
 * @param {number} imgH - Full image height in pixels.
 * @returns {boolean} true if the region passes all five heuristic tests.
 *
 * @example
 * // Filter a region array to keep only character-like blobs:
 * const chars = regions.filter(r => isCharacterLike(r, imageWidth, imageHeight));
 */
export function isCharacterLike(r, imgW, imgH) {
  const bboxArea = r.w * r.h;
  const density  = r.n / bboxArea;
  const aspect   = r.w > r.h ? r.w / r.h : r.h / r.w;  // always ≥ 1
  const minDim   = Math.min(r.w, r.h);

  // ── Test 1: Minimum dimension ─────────────────────────────────────────
  // Single-pixel-wide hairlines and sub-pixel noise artefacts
  if (minDim < MIN_CHAR_DIM) return false;

  // ── Test 2: Hard aspect ratio ceiling ────────────────────────────────
  // Extremely elongated blobs are rules, borders, or long underlines
  if (aspect > MAX_CHAR_ASPECT) return false;

  // ── Test 3: Moderate-aspect + low-density (dashed lines / sparse rules) ──
  // A slightly elongated blob that is mostly empty inside its bounding box
  if (aspect > MODERATE_ASPECT && density < MIN_LINE_DENSITY) return false;

  // ── Test 4: Fill density bounds ───────────────────────────────────────
  // Too sparse → stray dots or thin frame fragments
  if (density < FILL_DENSITY_MIN) return false;
  // Too solid  → filled block, photo region, or heavy ink bleed
  if (density > FILL_DENSITY_MAX) return false;

  // ── Test 5: Maximum image fraction ───────────────────────────────────
  // No single printable glyph should dominate the page
  if (bboxArea > imgW * imgH * MAX_CHAR_IMAGE_FRACTION) return false;

  return true;
}
