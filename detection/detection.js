/**
 * detection/detection.js
 * DBNet-inspired text detection pipeline running on WebGPU.
 *
 * GPU passes (detection.wgsl):
 *   1. sobelPass          — gradient edge magnitude
 *   2. probabilityMapPass — local edge density → text probability
 *   3. dilatePass         — morphological dilation of thresholded probability
 *
 * CPU post-processing:
 *   4. findBoundingBoxes  — connected-component labelling → [x,y,w,h] boxes
 *   5. Overlay boxes on canvas with confidence scores
 */

import {
  loadShader,
  createStorageBuffer,
  createUniformBuffer,
  buildUniforms,
  updateUniformBuffer,
  readbackBuffer,
  dispatchCompute,
  renderColormap,
  findBoundingBoxes,
} from '../utils/webgpu-utils.js';

const WGSL_PATH = './detection/detection.wgsl';
const WG        = 16;

export class TextDetectionPipeline {
  /** @param {GPUDevice} device */
  constructor(device) {
    this.device = device;
    this._ready  = false;
  }

  // ── Initialise ────────────────────────────────────────────────────────────
  async init() {
    const { device } = this;
    const shader = await loadShader(device, WGSL_PATH);

    const mkPipeline = (entry) =>
      device.createComputePipeline({
        label:   `det::${entry}`,
        layout:  'auto',
        compute: { module: shader, entryPoint: entry },
      });

    this.pipelineSobel   = mkPipeline('sobelPass');
    this.pipelineProb    = mkPipeline('probabilityMapPass');
    this.pipelineDilate  = mkPipeline('dilatePass');
    this._ready = true;
  }

  // ── Main entry point ──────────────────────────────────────────────────────
  /**
   * Run the full detection pipeline.
   *
   * @param {Float32Array} grayData — grayscale output from preprocessing
   * @param {number}       width
   * @param {number}       height
   * @param {{ edge, probability, detected }} canvases
   * @returns {{ edgeData, probData, dilatedData, boxes, timings }}
   */
  async run(grayData, width, height, canvases) {
    if (!this._ready) throw new Error('TextDetectionPipeline not initialised. Call init() first.');
    const { device } = this;
    const N    = width * height;
    const dispX = Math.ceil(width  / WG);
    const dispY = Math.ceil(height / WG);

    // ── GPU buffers ───────────────────────────────────────────────────────────
    const grayBuf   = createStorageBuffer(device, N, grayData);
    const edgeBuf   = createStorageBuffer(device, N);
    const probBuf   = createStorageBuffer(device, N);
    const dilateBuf = createStorageBuffer(device, N);

    // Detection threshold for dilation: pixels above this in the prob map
    // are considered text. Tuned to 0.35 for typical doc images.
    const PROB_THRESH = 0.35;

    const uniformBytes = buildUniforms(
      { type: 'u32', value: width  },
      { type: 'u32', value: height },
      { type: 'f32', value: PROB_THRESH },
      { type: 'f32', value: 0.0 },
    );
    const uniformBuf = createUniformBuffer(device, uniformBytes);

    // ── Pass 1 – Sobel edge detection ─────────────────────────────────────────
    const t0 = performance.now();

    dispatchCompute(device,
      this.pipelineSobel,
      this._bg(this.pipelineSobel, grayBuf, edgeBuf, uniformBuf),
      dispX, dispY,
    );

    const edgeData = await readbackBuffer(device, edgeBuf, N);
    const t1 = performance.now();
    renderColormap(canvases.edge, edgeData, width, height);

    // ── Pass 2 – Probability map ───────────────────────────────────────────────
    dispatchCompute(device,
      this.pipelineProb,
      this._bg(this.pipelineProb, edgeBuf, probBuf, uniformBuf),
      dispX, dispY,
    );

    const probData = await readbackBuffer(device, probBuf, N);
    const t2 = performance.now();
    renderColormap(canvases.probability, probData, width, height);

    // ── Pass 3 – Dilation ─────────────────────────────────────────────────────
    dispatchCompute(device,
      this.pipelineDilate,
      this._bg(this.pipelineDilate, probBuf, dilateBuf, uniformBuf),
      dispX, dispY,
    );

    const dilatedData = await readbackBuffer(device, dilateBuf, N);
    const t3 = performance.now();

    // ── CPU – Connected components → bounding boxes ────────────────────────────
    const boxes = findBoundingBoxes(dilatedData, width, height, 0.5);
    const t4 = performance.now();

    // ── Draw detection overlay ────────────────────────────────────────────────
    this._drawDetections(canvases.detected, grayData, dilatedData, boxes, width, height);

    // ── Cleanup ────────────────────────────────────────────────────────────────
    [grayBuf, edgeBuf, probBuf, dilateBuf, uniformBuf].forEach(b => b.destroy());

    return {
      edgeData, probData, dilatedData, boxes,
      timings: {
        sobel:     t1 - t0,
        probMap:   t2 - t1,
        dilate:    t3 - t2,
        cpuBBoxes: t4 - t3,
        total:     t4 - t0,
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  _bg(pipeline, inBuf, outBuf, unifBuf) {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf   } },
        { binding: 1, resource: { buffer: outBuf  } },
        { binding: 2, resource: { buffer: unifBuf } },
      ],
    });
  }

  /**
   * Compose the detected-regions canvas:
   *   - greyscale background
   *   - teal filled overlay for dilated regions
   *   - cyan bounding boxes with confidence
   */
  _drawDetections(canvas, grayData, dilatedData, boxes, W, H) {
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background: grey image
    const id = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = Math.max(0, Math.min(1, grayData[i])) * 255 | 0;
      id.data[i*4]=v; id.data[i*4+1]=v; id.data[i*4+2]=v; id.data[i*4+3]=255;
    }
    ctx.putImageData(id, 0, 0);

    // Dilated text mask overlay (semi-transparent teal)
    const overlay = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      if (dilatedData[i] > 0.5) {
        overlay.data[i*4]   = 0;
        overlay.data[i*4+1] = 212;
        overlay.data[i*4+2] = 255;
        overlay.data[i*4+3] = 55;
      }
    }
    ctx.putImageData(overlay, 0, 0);

    // Bounding boxes
    ctx.lineWidth   = 1.5;
    ctx.font        = '9px JetBrains Mono, monospace';
    ctx.textBaseline = 'top';

    const palette = ['#00d4ff', '#7c3aed', '#10b981', '#f59e0b', '#ef4444'];
    boxes.forEach(({ x, y, w, h, score }, i) => {
      const color = palette[i % palette.length];
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, w, h);

      // Confidence badge
      const label = `${(score * 100).toFixed(0)}%`;
      const tw    = ctx.measureText(label).width + 4;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 13, tw, 13);
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 2, y - 12);
    });

    // Summary
    ctx.fillStyle = 'rgba(6,8,16,0.75)';
    ctx.fillRect(4, H - 20, 150, 18);
    ctx.fillStyle = '#00d4ff';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText(`${boxes.length} region${boxes.length !== 1 ? 's' : ''} detected`, 8, H - 16);
  }
}
