// Pipeline configuration constants

export const CONFIG = {
  // Workgroup sizes for compute shaders
  WG_2D: [8, 8, 1],
  WG_1D: [256, 1, 1],
  WG_SEQ: [64, 1, 1],

  // Image preprocessing
  NORMALIZE_MEAN: [0.485, 0.456, 0.406],
  NORMALIZE_STD:  [0.229, 0.224, 0.225],
  TARGET_WIDTH:  640,
  TARGET_HEIGHT: 640,
  MAX_LONG_SIDE: 1280,

  // Gaussian blur
  GAUSS_KERNEL_SIZE: 5,
  GAUSS_SIGMA: 1.0,

  // Bilateral filter
  BILATERAL_D:  9,
  BILATERAL_SIGMA_COLOR: 0.1,
  BILATERAL_SIGMA_SPACE: 3.0,

  // Non-local means
  NLM_H:           10.0,
  NLM_SEARCH_WIN:  21,
  NLM_PATCH_SIZE:  7,

  // Deskew
  DESKEW_ANGLE_RANGE: 15.0,  // degrees
  DESKEW_ANGLE_STEPS: 180,

  // HOG
  HOG_CELL_SIZE: 8,
  HOG_BLOCK_SIZE: 2,
  HOG_NBINS: 9,

  // SuperPoint
  SUPERPOINT_DESC_DIM: 256,
  SUPERPOINT_THRESH:   0.015,
  SUPERPOINT_NMS_RAD:  4,

  // Text detection (DB)
  DB_THRESH:      0.3,
  DB_BOX_THRESH:  0.7,
  DB_MAX_CANDIDATES: 1000,
  DB_UNCLIP_RATIO:   1.5,

  // Morphology
  MORPH_KERNEL_SIZE: 3,

  // Recognition
  REC_IMG_H: 32,
  REC_IMG_W: 320,
  REC_CHANNELS: [3, 64, 128, 256, 512],

  // Transformer
  TRANS_D_MODEL:   512,
  TRANS_NHEAD:     8,
  TRANS_FF_DIM:    2048,
  TRANS_NLAYERS:   6,
  TRANS_MAX_SEQ:   160,

  // Classifier
  CHARSET_SIZE:  97,   // printable ASCII
  BLANK_IDX:     0,

  // Beam search
  BEAM_WIDTH:    10,
  MAX_DECODE_LEN: 64,
  LM_ALPHA:      0.6,
  LM_BETA:       1.0,

  // Layout
  BLOCK_TYPES: ['text','heading','table','figure','caption','list'],

  // Stage names
  STAGES: [
    { id: '01', name: 'IMAGE UPLOAD',       key: 'input'       },
    { id: '02', name: 'PREPROCESSING',      key: 'preprocess'  },
    { id: '03', name: 'FEATURE EXTRACT',    key: 'features'    },
    { id: '04', name: 'SUPERPOINT',         key: 'superpoint'  },
    { id: '05', name: 'FEATURE MATCHING',   key: 'matching'    },
    { id: '06', name: 'TEXT DETECTION',     key: 'detection'   },
    { id: '07', name: 'REGION EXTRACTION',  key: 'regions'     },
    { id: '08', name: 'GRAPH SEGMENT',      key: 'graphseg'    },
    { id: '09', name: 'LAYOUT ANALYSIS',    key: 'layout'      },
    { id: '10', name: 'TABLE DETECTION',    key: 'tables'      },
    { id: '11', name: 'GEOMETRY WARP',      key: 'geometry'    },
    { id: '12', name: 'REC ENCODER',        key: 'encoder'     },
    { id: '13', name: 'TRANSFORMER',        key: 'transformer' },
    { id: '14', name: 'CLASSIFIER',         key: 'classifier'  },
    { id: '15', name: 'GPU DECODE',         key: 'decode'      },
    { id: '16', name: 'DOC STRUCTURE',      key: 'structure'   },
  ],
};
