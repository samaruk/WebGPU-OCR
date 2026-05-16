/**
 * @file config.js
 * @description Central configuration for the Sauvola WebGPU pipeline.
 *
 * All magic numbers, thresholds, and UI defaults are declared here.
 * Changing a value in this file propagates everywhere automatically —
 * no hunting through algorithm files for hard-coded constants.
 *
 * ─── SECTIONS ────────────────────────────────────────────────────────────────
 *  1. Image limits
 *  2. Sauvola algorithm defaults
 *  3. Connected components
 *  4. Character separation (valley detection)
 *  5. Character-like filter heuristics
 *  6. Rendering / visual palette
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── 1. IMAGE LIMITS ──────────────────────────────────────────────────────────

/**
 * Maximum image memory budget in bytes (RGBA = 4 bytes/pixel).
 * Images whose raw pixel data exceeds this are uniformly scaled down
 * so that width × height × 4 = MAX_IMAGE_BYTES exactly.
 *
 * 128 MB covers most document scans up to ~5700 × 5700 px.
 *
 * @type {number}
 */
export const MAX_IMAGE_BYTES = 128 * 1024 * 1024;

// ── 2. SAUVOLA ALGORITHM DEFAULTS ────────────────────────────────────────────

/**
 * Default local window size (pixels, always odd).
 * A larger window captures slower-varying illumination (good for pages with
 * gradual shadows); a smaller window responds to fine local detail.
 * Recommended range: 11–31 for body text, 31–63 for very low-contrast scans.
 *
 * @type {number}
 */
export const DEFAULT_WIN_SIZE = 15;

/**
 * Default Sauvola sensitivity constant k ∈ [0.05, 0.95].
 * Higher k → threshold rises faster when local contrast is high,
 * making the binarizer more aggressive at picking up faint ink.
 * Typical document OCR: 0.20–0.35.
 *
 * @type {number}
 */
export const DEFAULT_K = 0.30;

/**
 * Normalisation constant R for the Sauvola formula.
 * For pixel values normalised to [0, 1], R = 0.5 is the conventional value
 * (half of the maximum possible standard deviation).
 * Changing this shifts all thresholds proportionally.
 *
 * @type {number}
 */
export const SAUVOLA_R = 0.5;

// ── 3. CONNECTED COMPONENTS ───────────────────────────────────────────────────

/**
 * Default minimum foreground-pixel count for a connected component
 * to be retained as a region candidate (before character filtering).
 * Components smaller than this are treated as noise.
 *
 * @type {number}
 */
export const DEFAULT_MIN_AREA = 80;

// ── 4. CHARACTER SEPARATION (valley detection) ────────────────────────────────

/**
 * Valley depth ratio threshold for the projection-profile splitter.
 * A local minimum in the column-count profile is accepted as a cut point
 * only when:
 *
 *   depth = 1 − profile[valley] / min(leftShoulder, rightShoulder) > VALLEY_DEPTH_THRESHOLD
 *
 * Higher values → fewer, more confident cuts (miss light touches).
 * Lower values  → more cuts (risk splitting wide single characters like W, M).
 *
 * @type {number}
 */
export const VALLEY_DEPTH_THRESHOLD = 0.38;

/**
 * Minimum shoulder-to-peak ratio for a valley to be considered.
 * Prevents cuts at the very edge of a blob where the "shoulder" is
 * just a thin fringe and not a real character peak.
 *
 * A shoulder below (maxProfile × MIN_SHOULDER_RATIO) is ignored.
 *
 * @type {number}
 */
export const MIN_SHOULDER_RATIO = 0.12;

/**
 * Maximum recursion depth for the recursive region splitter.
 * Each split level can separate one additional touching character.
 * Depth 8 handles up to ~9 characters fused into one blob.
 *
 * @type {number}
 */
export const MAX_SPLIT_DEPTH = 8;

/**
 * Minimum width in pixels for a split sub-region to be kept.
 * Sub-regions narrower than this are artefacts of a near-zero valley
 * and are discarded.
 *
 * @type {number}
 */
export const MIN_SPLIT_WIDTH = 2;

// ── 5. CHARACTER-LIKE FILTER ──────────────────────────────────────────────────

/**
 * Aspect ratio above which a region is unconditionally rejected as a line.
 * aspect = max(w, h) / min(w, h).
 * A character like 'l' or 'I' might reach ~6; real lines easily exceed 12.
 *
 * @type {number}
 */
export const MAX_CHAR_ASPECT = 12;

/**
 * Secondary aspect threshold used together with MIN_LINE_DENSITY.
 * Moderately elongated blobs (aspect > MODERATE_ASPECT) that are also
 * very sparse are classified as dashed rules / underlines.
 *
 * @type {number}
 */
export const MODERATE_ASPECT = 6;

/**
 * Fill-density ceiling for the moderate-aspect secondary test.
 * If aspect > MODERATE_ASPECT AND density < MIN_LINE_DENSITY → reject.
 *
 * @type {number}
 */
export const MIN_LINE_DENSITY = 0.18;

/**
 * Minimum fill density: foreground pixels / bounding-box area.
 * Below this the region is too sparse to be ink (stray dots, thin artefacts).
 *
 * @type {number}
 */
export const FILL_DENSITY_MIN = 0.07;

/**
 * Maximum fill density.
 * Above this the bounding box is nearly solid — ink bleed, photo region,
 * or a filled rule — not a printable glyph.
 *
 * @type {number}
 */
export const FILL_DENSITY_MAX = 0.92;

/**
 * Maximum fraction of the total image area a character bounding box may occupy.
 * Large blobs (borders, photo areas, full-page ruled boxes) are rejected.
 *
 * @type {number}
 */
export const MAX_CHAR_IMAGE_FRACTION = 0.04;

/**
 * Minimum pixel length of the shorter side of a bounding box.
 * Hairlines and single-row artefacts are filtered here.
 *
 * @type {number}
 */
export const MIN_CHAR_DIM = 3;

// ── 6. RENDERING / PALETTE ────────────────────────────────────────────────────

/**
 * 20-colour palette for region labelling in the Features and Boxes panels.
 * Colours are chosen for high mutual contrast on dark backgrounds.
 * The palette cycles when there are more regions than colours.
 *
 * @type {string[]}
 */
export const PALETTE = [
  '#d4922b', '#1a8f7c', '#c9363a', '#5a3fb5', '#2059a8',
  '#e05c9a', '#27a554', '#e07825', '#7c4dff', '#009688',
  '#e91e63', '#03a9f4', '#ff5722', '#4caf50', '#9c27b0',
  '#ff9800', '#00bcd4', '#f44336', '#8bc34a', '#673ab7',
];

/**
 * Background colour (RGBA components) used for the dark canvas background
 * in the Features rendering pass.
 *
 * @type {{r: number, g: number, b: number}}
 */
export const BG_COLOR = { r: 9, g: 10, b: 15 };

/**
 * RGB value for noise / filtered-out foreground pixels in the Features panel.
 * Shown as dim grey so the user can see discarded ink without confusion.
 *
 * @type {number}
 */
export const NOISE_GRAY = 48;

/**
 * Opacity for the dimmed original image drawn behind the bounding-box overlay.
 * 0 = invisible original; 1 = full brightness.
 *
 * @type {number}
 */
export const BOX_OVERLAY_ALPHA = 0.48;
