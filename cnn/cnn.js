/**
 * cnn/cnn.js
 * WebGPU CNN Feature Extraction Pipeline
 *
 * Runs 8 hand-crafted 3×3 filters sequentially through:
 *   convPass  (WebGPU) → reluPass (WebGPU) → maxPoolPass (WebGPU)
 *
 * All filter results are collected then rendered as two canvas grids:
 *   - 4×2 grid of ReLU feature maps (before pooling)
 *   - 4×2 grid of max-pooled feature maps
 */

import {
  loadShader,
  createStorageBuffer,
  createUniformBuffer,
  buildUniforms,
  readbackBuffer,
  dispatchCompute,
  renderFeatureGrid,
} from '../utils/webgpu-utils.js';

const WGSL_PATH = './cnn/cnn.wgsl';
const WG_CONV   = 16;
const WG_POOL   = 8;

// ── Eight hand-crafted filters for text feature extraction ────────────────────
// Format: { name, weights: f32[9], bias: f32 }
// Kernel layout: [row0col0, row0col1, row0col2,  row1…,  row2…]
export const CNN_FILTERS = [
  {
    name: 'Sobel-H',          // Horizontal edges (detects text baselines)
    weights: [-1,-2,-1,  0,0,0,  1,2,1],
    bias: 0.0,
  },
  {
    name: 'Sobel-V',          // Vertical edges (detects character stems)
    weights: [-1,0,1,  -2,0,2,  -1,0,1],
    bias: 0.0,
  },
  {
    name: 'Diag-NW',          // Diagonal edge ↘  (oblique strokes)
    weights: [-2,-1,0,  -1,0,1,  0,1,2],
    bias: 0.0,
  },
  {
    name: 'Diag-NE',          // Diagonal edge ↙  (oblique strokes)
    weights: [0,-1,-2,  1,0,-1,  2,1,0],
    bias: 0.0,
  },
  {
    name: 'Laplacian',        // Blob / corner detector (LoG approximation)
    weights: [0,1,0,  1,-4,1,  0,1,0],
    bias: 0.0,
  },
  {
    name: 'Sharpen',          // High-frequency enhancement
    weights: [0,-1,0,  -1,5,-1,  0,-1,0],
    bias: 0.0,
  },
  {
    name: 'Emboss',           // Surface relief (encodes orientation)
    weights: [-2,-1,0,  -1,1,1,  0,1,2],
    bias: 0.5,
  },
  {
    name: 'Smooth',           // Gaussian low-pass (context / smoothing)
    weights: [1/16, 2/16, 1/16,  2/16, 4/16, 2/16,  1/16, 2/16, 1/16],
    bias: 0.0,
  },
];

export class CNNPipeline {
  /** @param {GPUDevice} device */
  constructor(device) {
    this.device = device;
    this._ready  = false;
  }

  // ── Initialise ────────────────────────────────────────────────────────────
  async init() {
    const { device } = this;
    const shader = await loadShader(device, WGSL_PATH);

    // convPipeline uses all 4 bindings (0,1,2,3).
    // relu and pool pipelines use only 3 (0,1,2); layout:'auto' excludes binding 3.
    this.pipelineConv = device.createComputePipeline({
      label:   'cnn::convPass',
      layout:  'auto',
      compute: { module: shader, entryPoint: 'convPass' },
    });
    this.pipelineRelu = device.createComputePipeline({
      label:   'cnn::reluPass',
      layout:  'auto',
      compute: { module: shader, entryPoint: 'reluPass' },
    });
    this.pipelinePool = device.createComputePipeline({
      label:   'cnn::maxPoolPass',
      layout:  'auto',
      compute: { module: shader, entryPoint: 'maxPoolPass' },
    });

    this._ready = true;
  }

  // ── Main entry point ──────────────────────────────────────────────────────
  /**
   * Run all 8 filters and render results.
   *
   * @param {Float32Array} grayData
   * @param {number}       width
   * @param {number}       height
   * @param {{ cnnGrid, cnnPooled }} canvases
   */
  async run(grayData, width, height, canvases) {
    if (!this._ready) throw new Error('CNNPipeline not initialised. Call init() first.');
    const { device } = this;

    const W   = width;
    const H   = height;
    const N   = W * H;
    const PW  = Math.ceil(W / 2);
    const PH  = Math.ceil(H / 2);
    const PN  = PW * PH;

    // Shared input buffer (grayscale image)
    const inputBuf = createStorageBuffer(device, N, grayData);

    // Per-filter intermediate buffers (reused across filters)
    const convOutBuf = createStorageBuffer(device, N);
    const reluOutBuf = createStorageBuffer(device, N);
    const poolOutBuf = createStorageBuffer(device, PN);

    // Uniform buffers
    const unifConvRelu = createUniformBuffer(device, buildUniforms(
      { type: 'u32', value: W  },
      { type: 'u32', value: H  },
      { type: 'u32', value: PW },
      { type: 'u32', value: PH },
    ));
    const unifPool = createUniformBuffer(device, buildUniforms(
      { type: 'u32', value: W  },
      { type: 'u32', value: H  },
      { type: 'u32', value: PW },
      { type: 'u32', value: PH },
    ));

    // Weights buffer: 10 floats per filter (9 kernel + 1 bias)
    const weightsBuf = device.createBuffer({
      size: 10 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const dispX     = Math.ceil(W  / WG_CONV);
    const dispY     = Math.ceil(H  / WG_CONV);
    const poolDispX = Math.ceil(PW / WG_POOL);
    const poolDispY = Math.ceil(PH / WG_POOL);

    const featureMaps = [];  // relu outputs
    const pooledMaps  = [];  // pooled outputs

    const t0 = performance.now();

    for (let f = 0; f < CNN_FILTERS.length; f++) {
      const filter = CNN_FILTERS[f];

      // Upload kernel weights + bias for this filter
      const wData = new Float32Array(10);
      filter.weights.forEach((v, i) => { wData[i] = v; });
      wData[9] = filter.bias;
      device.queue.writeBuffer(weightsBuf, 0, wData);

      // ── Conv pass (uses binding 3 for weights) ──────────────────────────────
      const convBG = device.createBindGroup({
        layout: this.pipelineConv.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuf    } },
          { binding: 1, resource: { buffer: convOutBuf  } },
          { binding: 2, resource: { buffer: unifConvRelu } },
          { binding: 3, resource: { buffer: weightsBuf  } },
        ],
      });
      dispatchCompute(device, this.pipelineConv, convBG, dispX, dispY);

      // ── ReLU pass ───────────────────────────────────────────────────────────
      const reluBG = device.createBindGroup({
        layout: this.pipelineRelu.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: convOutBuf   } },
          { binding: 1, resource: { buffer: reluOutBuf   } },
          { binding: 2, resource: { buffer: unifConvRelu } },
        ],
      });
      dispatchCompute(device, this.pipelineRelu, reluBG, dispX, dispY);

      // ── MaxPool pass ────────────────────────────────────────────────────────
      const poolBG = device.createBindGroup({
        layout: this.pipelinePool.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: reluOutBuf } },
          { binding: 1, resource: { buffer: poolOutBuf } },
          { binding: 2, resource: { buffer: unifPool   } },
        ],
      });
      dispatchCompute(device, this.pipelinePool, poolBG, poolDispX, poolDispY);

      // ── Read back both outputs ───────────────────────────────────────────────
      const [reluData, poolData] = await Promise.all([
        readbackBuffer(device, reluOutBuf, N),
        readbackBuffer(device, poolOutBuf, PN),
      ]);

      featureMaps.push({ data: reluData, w: W,  h: H,  label: filter.name });
      pooledMaps.push ({ data: poolData, w: PW, h: PH, label: filter.name });
    }

    const t1 = performance.now();

    // ── Render grids ──────────────────────────────────────────────────────────
    renderFeatureGrid(canvases.cnnGrid,   featureMaps, 4);
    renderFeatureGrid(canvases.cnnPooled, pooledMaps,  4);

    // ── Cleanup ────────────────────────────────────────────────────────────────
    [inputBuf, convOutBuf, reluOutBuf, poolOutBuf,
     unifConvRelu, unifPool, weightsBuf].forEach(b => b.destroy());

    return {
      featureMaps,
      pooledMaps,
      timings: {
        total: t1 - t0,
        perFilter: (t1 - t0) / CNN_FILTERS.length,
      },
    };
  }
}
