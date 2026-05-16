// config.js — Global configuration for the GPU segmentation pipeline

export const CONFIG = {
  pipeline: {
    workgroupSize: 8,        // 8x8 = 64 threads per workgroup
    maxIterations: 512,      // Max CCL union-find iterations
    maxComponents: 4096,     // Max connected components to track
  },

  preprocess: {
    sobelThreshold: 30,
    binarizeThreshold: 128,
    morphologyEnabled: true,
    morphKernelSize: 3,      // must be odd: 1,3,5,7
    invertBinary: false,
  },

  ccl: {
    minArea: 20,
    maxArea: 10000,
  },

  watershed: {
    enabled: false,
    seedThreshold: 5,
    maxPropagations: 20,
  },

  display: {
    showBoundingBoxes: true,
    showLabels: true,
    colorByComponent: true,
    boxColors: [
      '#00d4aa', '#f0a030', '#e05090', '#50a0e0',
      '#a050e0', '#e0d050', '#50e090', '#e07050',
    ],
  },
};

// Component colors (cycling palette for visualization)
export const COMPONENT_PALETTE = [
  [0, 212, 170],   // teal
  [240, 160, 48],  // amber
  [224, 80, 144],  // pink
  [80, 160, 224],  // blue
  [160, 80, 224],  // purple
  [224, 208, 80],  // yellow
  [80, 224, 144],  // green
  [224, 112, 80],  // orange
  [80, 208, 224],  // cyan
  [192, 80, 80],   // red
  [80, 160, 80],   // dark green
  [160, 128, 80],  // brown
];
