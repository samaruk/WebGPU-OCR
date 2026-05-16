// ─────────────────────────────────────────────────────────────
//  src/config/modelConfig.js
//  ONNX model paths, input/output tensor names, shapes
// ─────────────────────────────────────────────────────────────

export const MODEL_CONFIG = {

  detection: {
    mobilenetv3: {
      path: './models/detection/dbnet_mobilenetv3.onnx',
      inputName:  'input',
      inputShape: [1, 3, 640, 640],      // NCHW
      outputNames: ['probability_map', 'threshold_map'],
      meanNorm:   [0.485, 0.456, 0.406],
      stdNorm:    [0.229, 0.224, 0.225],
      executionProviders: ['webgpu', 'wasm'],
    },
    resnet50: {
      path: './models/detection/dbnet_resnet50.onnx',
      inputName:  'input',
      inputShape: [1, 3, 640, 640],
      outputNames: ['probability_map', 'threshold_map'],
      meanNorm:   [0.485, 0.456, 0.406],
      stdNorm:    [0.229, 0.224, 0.225],
      executionProviders: ['webgpu', 'wasm'],
    },
  },

  recognition: {
    crnn: {
      path: './models/recognition/crnn_ctc.onnx',
      inputName:  'input',
      inputShape: [1, 1, 32, -1],        // dynamic width
      outputName: 'output',              // [T, 1, vocab]
      charset:    './models/recognition/charset.txt',
      executionProviders: ['wasm'],      // CRNN BiLSTM → wasm is fine
    },
    parseq: {
      path: './models/recognition/parseq_transformer.onnx',
      inputName:  'image',
      inputShape: [1, 3, 32, 128],
      outputName: 'logits',              // [1, maxLen, vocab]
      charset:    './models/recognition/charset.txt',
      executionProviders: ['webgpu', 'wasm'],
    },
  },

  features: {
    superpoint: {
      path: './models/features/superpoint.onnx',
      inputName:  'image',
      inputShape: [1, 1, -1, -1],
      outputNames: ['keypoints', 'scores', 'descriptors'],
      executionProviders: ['webgpu', 'wasm'],
    },
    lightglue: {
      path: './models/features/lightglue.onnx',
      inputNames: ['kpts0','kpts1','desc0','desc1'],
      outputNames: ['matches0','matching_scores0'],
      executionProviders: ['webgpu', 'wasm'],
    },
  },

  layout: {
    layoutlmv3: {
      path: './models/layout/layoutlmv3.onnx',
      inputNames: ['input_ids','attention_mask','bbox','pixel_values'],
      outputName: 'logits',
      numLabels:  6,
      executionProviders: ['webgpu', 'wasm'],
    },
  },

  table: {
    tableTransformer: {
      path: './models/table/table_transformer.onnx',
      inputName:  'pixel_values',
      inputShape: [1, 3, 448, 448],
      outputNames: ['pred_logits', 'pred_boxes'],
      executionProviders: ['webgpu', 'wasm'],
    },
  },
};

export default MODEL_CONFIG;
