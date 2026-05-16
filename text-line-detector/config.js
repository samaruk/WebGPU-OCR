/**
 * config.js — Single source of truth for every tunable constant.
 *
 * WHY THIS FILE EXISTS:
 *   Magic numbers scattered across shaders, GPU helpers, and CPU code make it impossible
 *   to reason about how a parameter change propagates. This file centralises every value
 *   that might need tuning so the rest of the codebase can import and trust one object.
 */

export const cfg = {
  radius:   20,   // Sauvola local window half-size (px).
  k:        0.2,  // Sauvola sensitivity [0.05–0.5].
  dilW:     28,   // Horizontal dilation SE half-width (px).
  dilH:     4,    // Vertical dilation SE half-height (px).
  minArea:  400,  // Reject blobs smaller than this (px²).
  minLen:   30,   // Reject skeleton branches shorter than this (px).
  zsIters:  35,   // Zhang-Suen thinning iterations (each = 2 GPU passes).
  ccaIters: 30,   // Parallel union-find CCA merge+compress cycles.
};

/** Maximum RGBA image size (MB) before auto-downscaling the processing pass. */
export const MAX_PROC_MB = 128;

/**
 * CS_BITS — Right-shift for GPU 1st-order stats to keep Σx inside u32.
 * See shaders/stats.js for full overflow analysis.
 */
export const CS_BITS = 5;

/**
 * PROJ_SCALE — Integer scale factor for GPU projection accumulation.
 *
 * WHY 16:
 *   float projection u = dx*vx + dy*vy is multiplied by PROJ_SCALE before rounding
 *   to i32 for atomicMin/atomicMax. This gives 1/16 px = 0.0625 px OBB precision.
 *
 *   Overflow check: max |u| ≤ sqrt(W²+H²)/2. For the largest image allowed by
 *   MAX_PROC_MB (128 MB RGBA → N ≤ 32M → max dim ≤ ~8000 px for landscape):
 *     max |u| ≈ sqrt(8000²+4000²)/2 ≈ 4472 px
 *     max |u_scaled| = 4472 × 16 = 71 552 → well within i32 (±2 147 483 647). ✓
 */
export const PROJ_SCALE = 16;

/** Number of float32 fields per OBB entry in the GPU render buffer. */
export const OBB_STRIDE = 10;

export const PALETTE = [
  '#00d084','#0af0ff','#ff4488','#ffcc44','#8844ff',
  '#ff8844','#44ffcc','#ff44bb','#44bbff','#ccff44',
];

export const PALETTE_RGB = [
  [0,       208/255, 132/255],
  [10/255,  240/255, 1      ],
  [1,       68/255,  136/255],
  [1,       204/255, 68/255 ],
  [136/255, 68/255,  1      ],
  [1,       136/255, 68/255 ],
  [68/255,  1,       204/255],
  [1,       68/255,  187/255],
  [68/255,  187/255, 1      ],
  [204/255, 1,       68/255 ],
];
