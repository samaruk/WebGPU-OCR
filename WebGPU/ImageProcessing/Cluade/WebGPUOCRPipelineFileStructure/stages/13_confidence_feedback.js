/**
 * 13_confidence_feedback.js — Confidence Scoring & Feedback Loop
 *
 * Final stage: evaluates per-region OCR confidence and routes low-confidence
 * regions back for re-processing with adjusted parameters.
 *
 * Responsibilities:
 *   1. Aggregate per-character confidence from CTC log-probs
 *   2. Flag regions below confidence threshold for retry
 *   3. Adjust retry parameters (contrast boost, SR toggle, threshold)
 *   4. Emit the final structured output document
 *
 * Also computes a global pipeline quality report.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL: Per-region confidence map visualization ────────────────────────────

// Render confidence heatmap overlay onto output image
const SHADER_CONFIDENCE_OVERLAY = /* wgsl */`
struct U {
  imgW:       u32,
  imgH:       u32,
  alpha:      f32,
  _p:         u32,
}

@group(0) @binding(0) var<uniform>            u:       U;
@group(0) @binding(1) var<storage,read_write> img:     array<u32>;   // RGBA8 output image
@group(0) @binding(2) var<storage,read>       scores:  array<f32>;   // per-region scores (N)
@group(0) @binding(3) var<storage,read>       bboxes:  array<u32>;   // N*4: x,y,w,h

// Draw a colored confidence border around each bounding box
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  // Each thread = one pixel. Check if inside any bbox border.
  let pixIdx = gid.x;
  if (pixIdx >= u.imgW * u.imgH) { return; }

  let px = pixIdx % u.imgW;
  let py = pixIdx / u.imgW;

  // (This is an O(N*pixels) pass - fine for small N)
  // For large N consider rendering bboxes per-bbox instead
  var closest = -1.0;
  var closestScore = 0.0;
  for (var r = 0u; r < arrayLength(&scores); r++) {
    let bx = bboxes[r*4u + 0u];
    let by = bboxes[r*4u + 1u];
    let bw = bboxes[r*4u + 2u];
    let bh = bboxes[r*4u + 3u];
    let borderW = 2u;
    let inBox = px >= bx && px < bx+bw && py >= by && py < by+bh;
    let onBorder = inBox && (
      px < bx+borderW || px >= bx+bw-borderW ||
      py < by+borderW || py >= by+bh-borderW
    );
    if (onBorder) {
      closest = 1.0;
      closestScore = scores[r];
      break;
    }
  }

  if (closest < 0.0) { return; }

  // Color: green (high confidence) → red (low confidence)
  let s = clamp(closestScore, 0.0, 1.0);
  let r = u32((1.0 - s) * 255.0);
  let g = u32(s * 255.0);
  let b = 0u;

  let existing = img[pixIdx];
  let er = f32((existing >>  0u) & 0xFFu);
  let eg = f32((existing >>  8u) & 0xFFu);
  let eb = f32((existing >> 16u) & 0xFFu);

  let nr = u32(mix(er, f32(r), u.alpha));
  let ng = u32(mix(eg, f32(g), u.alpha));
  let nb = u32(mix(eb, f32(b), u.alpha));
  img[pixIdx] = nr | (ng << 8u) | (nb << 16u) | 0xFF000000u;
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class ConfidenceFeedbackStage {
  constructor(options = {}) {
    this.confidenceThreshold    = options.confidenceThreshold    ?? 0.5;
    this.maxRetries             = options.maxRetries             ?? 2;
    this.retryContrastBoost     = options.retryContrastBoost     ?? 0.3;
    this.retrySRThreshold       = options.retrySRThreshold       ?? 0.3;
    this.enableVisualization    = options.enableVisualization    ?? false;
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    this._p = {
      overlay: gpuContext.createComputePipeline(
        gpuContext.createShaderModule(SHADER_CONFIDENCE_OVERLAY, 'conf:overlay'), 'main'),
    };
  }

  /**
   * Evaluate per-region results, flag low-confidence regions, and build output.
   *
   * @param {OCRResult[]}       ocrResults    - from OCRTransformerStage
   * @param {UnclipResult}      regions       - from UnclipScoreStage
   * @param {IQAResult}         iqaResult     - from IQAStage
   * @param {OrientationResult} orientResult  - from OrientationStage
   * @param {number}            retryCount    - current retry iteration
   * @returns {Promise<FeedbackResult>}
   */
  async run(ocrResults, regions, iqaResult, orientResult, retryCount = 0) {
    gpuContext.assertReady();
    await this._build();

    const regionList = regions.regions ?? [];

    // ── 1. Per-region confidence analysis ─────────────────────────────────
    const annotated = ocrResults.map((result, i) => {
      const region = regionList[i] ?? {};

      // Compute a composite confidence score
      const textLen     = result.text.length;
      const charConf    = result.confidence;
      const regionScore = region.combinedScore ?? region.score ?? 0.5;

      // Penalize empty results
      const lengthPenalty = textLen === 0 ? 0.0 : Math.min(1.0, textLen / 3);

      // Final composite confidence
      const compositeConf = charConf * 0.5 + regionScore * 0.3 + lengthPenalty * 0.2;

      // Classify issues
      const issues = [];
      if (textLen === 0)             issues.push('empty');
      if (charConf < 0.3)           issues.push('low_char_confidence');
      if (regionScore < 0.35)       issues.push('low_region_score');
      if (/[^\x20-\x7E]/.test(result.text)) issues.push('non_ascii');
      if (result.text.length > 100) issues.push('too_long');

      return {
        text:           result.text,
        confidence:     compositeConf,
        charConfidence: charConf,
        regionScore,
        issues,
        bbox:           region.bbox,
        polygon:        region.polygon,
        angle:          region.angle,
        needsRetry:     compositeConf < this.confidenceThreshold && retryCount < this.maxRetries,
        retryParams:    compositeConf < this.confidenceThreshold
                          ? this._computeRetryParams(compositeConf, issues, iqaResult)
                          : null,
      };
    });

    // ── 2. Global statistics ───────────────────────────────────────────────
    const meanConf = annotated.length
      ? annotated.reduce((s, r) => s + r.confidence, 0) / annotated.length
      : 0;
    const highConf  = annotated.filter(r => r.confidence >= 0.7).length;
    const midConf   = annotated.filter(r => r.confidence >= 0.4 && r.confidence < 0.7).length;
    const lowConf   = annotated.filter(r => r.confidence < 0.4).length;
    const retryList = annotated.filter(r => r.needsRetry);

    // ── 3. Build structured document output ───────────────────────────────
    const textBlocks = annotated
      .filter(r => r.text.length > 0 && !r.issues.includes('empty'))
      .sort((a, b) => {
        // Reading order: top-to-bottom, left-to-right
        if (!a.bbox || !b.bbox) return 0;
        const dy = a.bbox.y - b.bbox.y;
        if (Math.abs(dy) > 20) return dy;
        return a.bbox.x - b.bbox.x;
      });

    const fullText = textBlocks.map(b => b.text).join('\n');

    const pipelineReport = {
      iqaScore:        iqaResult.score,
      iqaFlags:        Array.from(iqaResult.flags),
      orientation:     orientResult.orientationDeg,
      scriptDirection: orientResult.scriptDirection,
      regionsDetected: regionList.length,
      regionsRecognized: annotated.length,
      highConfidence:  highConf,
      midConfidence:   midConf,
      lowConfidence:   lowConf,
      meanConfidence:  meanConf,
      retryRequired:   retryList.length > 0,
      retryCount,
      retryRegions:    retryList.length,
    };

    // ── 4. Feedback routing instructions ─────────────────────────────────
    const feedback = {
      shouldRetry: retryList.length > 0 && retryCount < this.maxRetries,
      retryRegions: retryList,
      globalRetryParams: this._globalRetryParams(iqaResult, meanConf, retryCount),
    };

    return {
      // Final recognized text
      fullText,
      textBlocks,
      annotatedRegions: annotated,

      // Pipeline metadata
      pipelineReport,

      // Feedback loop control
      feedback,

      // Summary stats
      totalRegions: annotated.length,
      meanConfidence: meanConf,
    };
  }

  /**
   * Compute per-region retry parameters.
   * @private
   */
  _computeRetryParams(confidence, issues, iqaResult) {
    const params = {};

    if (issues.includes('low_char_confidence') || issues.includes('empty')) {
      // Boost contrast for this region
      params.contrastBoost = this.retryContrastBoost;
      // Force super-resolution
      params.forceSuperRes = true;
    }

    if (issues.includes('non_ascii')) {
      // May be a different script — adjust binarization threshold
      params.binaryThreshold = 0.25;
    }

    if (confidence < this.retrySRThreshold) {
      // Very low confidence: try inverting the image (possible dark background)
      params.tryInvert = true;
    }

    return params;
  }

  /**
   * Compute global pipeline retry parameters.
   * @private
   */
  _globalRetryParams(iqaResult, meanConf, retryCount) {
    return {
      // Increase enhancement aggressiveness on retry
      claheClipLimit:    0.04 + retryCount * 0.02,
      binaryThreshold:   0.3  - retryCount * 0.05,
      unclipRatio:       1.5  + retryCount * 0.2,
      minRegionScore:    0.25 - retryCount * 0.05,
      // Force SR if mean confidence is very low
      forceSuperRes:     meanConf < 0.4,
    };
  }

  /**
   * Render a confidence visualization overlay onto a GPU image tensor.
   * Returns modified copy of the image.
   * @param {Tensor} imgTensor - [H * W] u32 RGBA8
   * @param {number} imgH, imgW
   * @param {AnnotatedRegion[]} annotated
   * @returns {Promise<Tensor>}
   */
  async renderConfidenceOverlay(imgTensor, imgH, imgW, annotated) {
    gpuContext.assertReady();
    await this._build();

    // Pack scores and bboxes into GPU buffers
    const N = annotated.length;
    if (N === 0) return imgTensor;

    const scoreData = new Float32Array(N);
    const bboxData  = new Uint32Array(N * 4);
    for (let i = 0; i < N; i++) {
      scoreData[i] = annotated[i].confidence;
      const b = annotated[i].bbox ?? { x: 0, y: 0, w: 0, h: 0 };
      bboxData[i * 4 + 0] = Math.round(b.x);
      bboxData[i * 4 + 1] = Math.round(b.y);
      bboxData[i * 4 + 2] = Math.round(b.w);
      bboxData[i * 4 + 3] = Math.round(b.h);
    }

    const scoresTensor = Tensor.fromData(scoreData, [N],    'f32', 'conf:scores');
    const bboxesTensor = Tensor.fromData(bboxData,  [N * 4], 'u32', 'conf:bboxes');

    // Copy image to output (we modify in-place)
    const outTensor = new Tensor([imgH * imgW], 'u32', 0, 'conf:out');
    {
      const enc = gpuContext.device.createCommandEncoder();
      enc.copyBufferToBuffer(imgTensor.buffer, 0, outTensor.buffer, 0, imgH * imgW * 4);
      gpuContext.queue.submit([enc.finish()]);
    }

    const u = createUniformBuffer({ imgW, imgH, alpha: 0.85, _p: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.overlay.getBindGroupLayout(0),
      entries: [
        u.bindingEntry(0),
        outTensor.bindingEntry(1),            // read_write (in-place)
        scoresTensor.bindingEntry(2, true),
        bboxesTensor.bindingEntry(3, true),
      ],
    });
    gpuContext.dispatch(this._p.overlay, bg, [Math.ceil(imgH * imgW / 256), 1, 1]);

    await gpuContext.sync();
    scoresTensor.destroy();
    bboxesTensor.destroy();

    return outTensor;
  }
}

/**
 * @typedef {Object} AnnotatedRegion
 * @property {string}   text
 * @property {number}   confidence
 * @property {number}   charConfidence
 * @property {number}   regionScore
 * @property {string[]} issues
 * @property {{x,y,w,h}} bbox
 * @property {boolean}  needsRetry
 * @property {Object|null} retryParams
 */

/**
 * @typedef {Object} FeedbackResult
 * @property {string}           fullText
 * @property {AnnotatedRegion[]} textBlocks
 * @property {AnnotatedRegion[]} annotatedRegions
 * @property {Object}           pipelineReport
 * @property {Object}           feedback
 * @property {number}           totalRegions
 * @property {number}           meanConfidence
 */
