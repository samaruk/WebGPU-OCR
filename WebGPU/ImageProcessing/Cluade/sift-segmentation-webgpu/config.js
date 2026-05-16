// config.js — All constants, workgroup sizes, thresholds

export const Config = Object.freeze({

  // ─── GPU Workgroup Sizes ───────────────────────────────────────────────────
  WG: {
    DEFAULT_X: 8,
    DEFAULT_Y: 8,
    DEFAULT_Z: 1,
    FLAT_256:  256,
    FLAT_128:  128,
    FLAT_64:   64,
    REDUCTION: 256,
    HISTOGRAM: 256,
    SCAN:      512,
  },

  // ─── Image / Upload ────────────────────────────────────────────────────────
  TEXTURE_FORMAT:        'rgba8unorm',
  GRAY_FORMAT:           'r32float',
  MAX_IMAGE_DIM:         4096,

  // ─── Preprocessing ─────────────────────────────────────────────────────────
  CLAHE_TILE_SIZE:       64,
  CLAHE_CLIP_LIMIT:      4.0,
  CLAHE_NUM_BINS:        256,
  GAMMA:                 1.0,
  BILATERAL_SIGMA_S:     3.0,
  BILATERAL_SIGMA_R:     0.1,
  BILATERAL_RADIUS:      5,
  GAUSSIAN_KERNEL_SIZE:  15,
  GAUSSIAN_SIGMA:        1.6,

  // ─── Scale-Space Pyramid ──────────────────────────────────────────────────
  PYRAMID_OCTAVES:       4,
  PYRAMID_SCALES:        5,
  PYRAMID_SIGMA_BASE:    1.6,
  PYRAMID_K:             Math.pow(2, 1 / 5),
  PYRAMID_MIN_DIM:       16,

  // ─── SIFT Keypoint Detection ──────────────────────────────────────────────
  SIFT_CONTRAST_THRESH:  0.04,
  SIFT_EDGE_THRESH:      10.0,
  SIFT_MAX_KEYPOINTS:    16384,
  SIFT_DESCRIPTOR_DIM:   128,
  SIFT_ORIENTATION_BINS: 36,
  SIFT_ORI_PEAK_RATIO:   0.8,
  SIFT_ORI_RADIUS:       4.5,
  SIFT_ORI_SIG_FACTOR:   1.5,
  SIFT_DESC_WIDTH:       4,
  SIFT_DESC_HIST_BINS:   8,
  SIFT_DESC_MAG_THR:     0.2,
  SIFT_DESC_SCALE_MUL:   3.0,
  SIFT_SUBPIXEL_ITERS:   5,
  SIFT_SUBPIXEL_THRESH:  0.5,

  // ─── Clustering ───────────────────────────────────────────────────────────
  CLUSTER_GRID_CELL:     32,
  CLUSTER_MAX_REGIONS:   4096,
  CLUSTER_SIMILARITY_THRESH: 0.7,
  CLUSTER_DENSITY_SIGMA: 16.0,
  CLUSTER_LABEL_ITERS:   32,

  // ─── Stroke Width ─────────────────────────────────────────────────────────
  STROKE_RAY_STEPS:      64,
  STROKE_MAX_WIDTH:      128.0,
  STROKE_MIN_WIDTH:      1.0,
  STROKE_CONSISTENCY_THRESH: 0.3,
  STROKE_MEDIAN_RADIUS:  3,

  // ─── Fusion ───────────────────────────────────────────────────────────────
  FUSION_ALPHA:          0.5,
  FUSION_CONF_THRESH:    0.4,

  // ─── Segmentation ─────────────────────────────────────────────────────────
  SEG_BINARY_THRESH:     0.5,
  SEG_MIN_COMPONENT:     64,
  SEG_MAX_LABELS:        8192,
  SEG_LABEL_ITERS:       128,

  // ─── Skeleton / Thinning ──────────────────────────────────────────────────
  SKEL_MAX_ITERS:        256,
  SKEL_BRANCH_MIN_LEN:   4,

  // ─── Graph / Merge-Split ──────────────────────────────────────────────────
  GRAPH_MAX_EDGES:       65536,
  GRAPH_MERGE_THRESH:    0.6,
  GRAPH_SPLIT_THRESH:    0.4,
  GRAPH_MAX_ITERS:       64,

  // ─── Post-process ─────────────────────────────────────────────────────────
  POST_ASPECT_MIN:       0.05,
  POST_ASPECT_MAX:       20.0,
  POST_POLY_EPSILON:     2.0,
  POST_MIN_AREA:         100,

  // ─── Debug ────────────────────────────────────────────────────────────────
  DEBUG_KEYPOINT_RADIUS: 3,
  DEBUG_LABEL_PALETTE:   64,

  // ─── Buffer Alignment ─────────────────────────────────────────────────────
  UNIFORM_ALIGN:         256,
  STORAGE_ALIGN:         16,
});

export default Config;
