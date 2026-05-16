// config.js – Central configuration for the Invoice Engine pipeline
// All values are defaults; the UI sliders override at runtime.

export const Config = {
  // ── Texture ──────────────────────────────────────────────────────────────
  // WebGPU requires texture dimensions to be multiples of 256 bytes per row
  // (i.e. width * bytesPerTexel must align to 256). We pad at upload time.
  TEXTURE_ALIGN: 256,          // bytes per row alignment
  MAX_DIM: 4096,               // max texture side; larger images are downscaled

  // ── Adaptive Threshold (Sauvola / Bradley) ───────────────────────────────
  THRESH_WINDOW: 31,           // local window radius (must be odd)
  THRESH_BIAS: 0.15,           // k in Sauvola: T = mean * (1 - k*(std/R - 1))
  THRESH_R: 128,               // Sauvola R constant (half-dynamic-range)

  // ── JFA (Jump Flood Algorithm) ───────────────────────────────────────────
  JFA_PASSES: 12,              // ceil(log2(max(W,H))) — computed at runtime
  JFA_INF: 0x7fff,             // sentinel for "no seed" (packed coord)

  // ── SDF & Circle Detection ───────────────────────────────────────────────
  SDF_LOCAL_RADIUS: 3,         // neighbourhood for local maxima detection (px)
  CIRCLE_MIN_R: 3,             // minimum inscribed circle radius to keep (px)
  CIRCLE_MAX_R: 40,            // maximum inscribed circle radius to keep (px)
  CIRCLE_SUPPRESSION: 0.5,     // NMS overlap threshold

  // ── Morphology ───────────────────────────────────────────────────────────
  MORPH_KERNEL: 5,             // separable kernel half-width
  MORPH_OP: 'dilate',          // 'dilate' | 'erode'

  // ── Projection / Text-Line Detection ────────────────────────────────────
  ROW_PROJ_THRESHOLD: 0.1,     // fraction of width that must be filled to be a "text row"
  LINE_MERGE_GAP: 8,           // merge row-runs separated by ≤ N px of white space

  // ── Table Detection ──────────────────────────────────────────────────────
  TABLE_MIN_COLS: 2,           // minimum columns to call something a table
  TABLE_MIN_ROWS: 2,
  TABLE_COL_ALIGN_TOL: 8,      // column-alignment tolerance (px)
  TABLE_LINE_VOTE_THRESH: 0.6, // fraction of rows that must vote for a column divider

  // ── Workgroup sizes ──────────────────────────────────────────────────────
  WG_2D: [16, 16],             // 2-D compute workgroup (total = 256 threads)
  WG_1D: 256,                  // 1-D compute workgroup

  // ── OCR (Tesseract.js) ───────────────────────────────────────────────────
  OCR_LANG: 'eng',
  OCR_PSM: 6,                  // Page Segmentation Mode (6 = assume uniform block)

  // ── Debug / Profiling ────────────────────────────────────────────────────
  ENABLE_PROFILING: true,
  PROFILE_BUFFER_ENTRIES: 32,  // max timestamp pairs to record

  // ── UI ───────────────────────────────────────────────────────────────────
  CIRCLE_ALPHA: 0.55,
  LINE_COLOR: 'rgba(0, 229, 255, 0.5)',
  TABLE_COLOR: 'rgba(124, 58, 237, 0.6)',
  CIRCLE_PALETTE: [
    'rgba(0,229,255,',
    'rgba(124,58,237,',
    'rgba(0,200,150,',
    'rgba(245,158,11,',
    'rgba(239,68,68,',
  ],
};

// Derive JFA passes from image size at runtime
Config.jfaPasses = (w, h) => Math.ceil(Math.log2(Math.max(w, h)));
