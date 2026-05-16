// ─────────────────────────────────────────────────────────────
//  src/config/pipelineConfig.js
//  Master pipeline configuration – stage ordering, flags, thresholds
// ─────────────────────────────────────────────────────────────

export const PIPELINE_CONFIG = {

  // Stages that can run in parallel (no data dependency between them)
  parallelGroups: [
    ['stage07_layout_analysis', 'stage09_crop_warp'],  // layout + crop warping are independent
  ],

  // Per-stage enable flags  (set false to skip)
  stages: {
    stage01_image_decode:           { enabled: true,  label: 'Image Decode' },
    stage02_gpu_preprocess:         { enabled: true,  label: 'GPU Preprocess' },
    stage03_backbone_inference:     { enabled: true,  label: 'Backbone Inference' },
    stage04_db_postprocess:         { enabled: true,  label: 'DB Postprocess' },
    stage05_gpu_connected_components:{ enabled: true, label: 'Connected Components' },
    stage06_polygon_refine:         { enabled: true,  label: 'Polygon Refinement' },
    stage07_layout_analysis:        { enabled: true,  label: 'Layout Analysis' },
    stage08_table_detection:        { enabled: true,  label: 'Table Detection' },
    stage09_crop_warp:              { enabled: true,  label: 'Crop & Warp' },
    stage10_recognition_router:     { enabled: true,  label: 'Recognition Router' },
    stage11_crnn_inference:         { enabled: true,  label: 'CRNN Inference' },
    stage12_parseq_inference:       { enabled: true,  label: 'PARSeq Inference' },
    stage13_ctc_decode:             { enabled: true,  label: 'CTC Decode' },
    stage14_lm_rescore:             { enabled: true,  label: 'LM Rescore' },
    stage15_document_assembly:      { enabled: true,  label: 'Document Assembly' },
  },

  // Detection
  detection: {
    backbone: 'mobilenetv3',        // 'mobilenetv3' | 'resnet50'
    inputSize: [640, 640],
    binaryThreshold: 0.3,
    polygonThreshold: 0.5,
    unclipRatio: 1.6,
    minBoxArea: 16,
    dilateIterations: 2,
    dbAmplification: 50,
  },

  // GPU preprocessing
  preprocess: {
    imagenetMean: [0.485, 0.456, 0.406],
    imagenetStd:  [0.229, 0.224, 0.225],
    denoiseThreshold: 0.6,          // quality score below this triggers denoise
    gammaCorrection: 1.3,
  },

  // Recognition routing
  recognition: {
    crnnThreshold: 0.85,            // confidence above which CRNN result is kept
    crnnMaxWidth: 320,
    crnnHeight: 32,
    parseqHeight: 32,
    parseqMaxWidth: 512,
    maxSeqLen: 25,
    skipLMForNumerics: true,
    skipLMMinConfidence: 0.85,
    skipLMSingleChar: true,
  },

  // Layout
  layout: {
    classLabels: ['text', 'title', 'list', 'table', 'figure', 'caption'],
    readingOrderRowTolerance: 12,   // px tolerance for same-row grouping
  },

  // Table
  table: {
    iouThreshold: 0.5,
    minCellArea: 32,
  },

  // Visualization
  viz: {
    canvasWidth: 640,
    canvasHeight: 240,
    overlayAlpha: 0.55,
    probMapColormap: 'amber',
    heatmapColormap: 'cyan',
  },
};

export default PIPELINE_CONFIG;
