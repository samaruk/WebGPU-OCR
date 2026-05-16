/**
 * main.js — OCR-WebGPU Pipeline Orchestrator
 *
 * Entry point for the full OCR pipeline. Coordinates all 13 stages:
 *
 *   01 IQA             → Image quality assessment & flags
 *   02 Orientation     → Page rotation & script direction
 *   03 Textness        → Text region probability map
 *   04 Enhancement     → Adaptive image enhancement
 *   05 DBNet           → Text detection (probability + binary maps)
 *   06 PolygonExtract  → Contour → polygon extraction
 *   07 UnclipScore     → Polygon expansion + NMS + scoring
 *   08 Deskew          → Per-region rotation correction
 *   09 LineCrop        → Extract line image patches
 *   10 LineNormalize   → Resize + gray normalize for recognition
 *   11 SuperRes        → Optional 2× upscaling for small text
 *   12 OCRTransformer  → CTC-based text recognition
 *   13 Feedback        → Confidence scoring + retry loop
 *
 *   Layout Engine      → Document structure reconstruction
 *
 * Usage:
 *   import { OCRPipeline } from './main.js';
 *   const ocr = new OCRPipeline();
 *   await ocr.init();
 *   const result = await ocr.recognize(imageBitmap);
 *   console.log(result.fullText);
 */

import { gpuContext }            from './core/gpuContext.js';
import { Tensor }                from './core/tensor.js';

import { IQAStage }              from './stages/01_iqa.js';
import { OrientationScriptStage }from './stages/02_orientation_script.js';
import { TextnessStage }         from './stages/03_textness.js';
import { AdaptiveEnhanceStage }  from './stages/04_adaptive_enhance.js';
import { DBNetStage, DBNetWeights } from './stages/05_dbnet.js';
import { PolygonExtractStage }   from './stages/06_polygon_extract.js';
import { UnclipScoreStage }      from './stages/07_unclip_score.js';
import { DeskewStage }           from './stages/08_deskew.js';
import { LineCropStage }         from './stages/09_line_crop.js';
import { LineNormalizeStage }    from './stages/10_line_normalize.js';
import { SuperResolutionStage }  from './stages/11_super_resolution.js';
//import { OCRTransformerStage }   from './stages/12_ocr_transformer.js';
import { ConfidenceFeedbackStage }from './stages/13_confidence_feedback.js';

import { BinarizationStage }     from './parallel/binarization.js';
import { MorphologyStage }       from './parallel/morphology.js';
import { CCAStage }              from './parallel/cca.js';

import { LayoutEngine }          from './layout/layout_engine.js';

// ─── Pipeline Configuration ───────────────────────────────────────────────────

/**
 * @typedef {Object} OCRConfig
 * @property {string}  [powerPreference]   - 'high-performance' | 'low-power'
 * @property {number}  [targetH]           - Normalized line height (default 32)
 * @property {number}  [maxW]              - Max line width (default 320)
 * @property {number}  [confidenceThreshold] - Retry below this (default 0.5)
 * @property {number}  [maxRetries]        - Max retry iterations (default 2)
 * @property {number}  [binaryThreshold]   - DBNet binarization threshold (default 0.3)
 * @property {number}  [unclipRatio]       - Polygon expansion ratio (default 1.5)
 * @property {boolean} [enableSuperRes]    - Enable SR stage (default true)
 * @property {boolean} [enableDebugOverlay]- Render confidence overlay (default false)
 * @property {boolean} [applyPolygonMask]  - Mask crops to polygon shape (default false)
 * @property {string}  [dbnetWeightsUrl]   - URL to DBNet weights .bin
 * @property {string}  [ocrWeightsUrl]     - URL to OCR transformer weights .bin
 * @property {string}  [srWeightsUrl]      - URL to SR model weights .bin
 */

const DEFAULT_CONFIG = {
  powerPreference:    'high-performance',
  targetH:            32,
  maxW:               320,
  confidenceThreshold:0.5,
  maxRetries:         2,
  binaryThreshold:    0.3,
  unclipRatio:        1.5,
  enableSuperRes:     true,
  enableDebugOverlay: false,
  applyPolygonMask:   false,
  dbnetWeightsUrl:    null,
  ocrWeightsUrl:      null,
  srWeightsUrl:       null,
};

// ─── Pipeline Class ───────────────────────────────────────────────────────────

export class OCRPipeline {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._ready = false;

    // Stage instances
    this.iqa          = new IQAStage();
    this.orientation  = new OrientationScriptStage();
    this.textness     = new TextnessStage();
    this.enhance      = new AdaptiveEnhanceStage();
    this.dbnet        = new DBNetStage();
    this.polyExtract  = new PolygonExtractStage();
    this.unclip       = new UnclipScoreStage();
    this.deskew       = new DeskewStage();
    this.lineCrop     = new LineCropStage();
    this.lineNorm     = new LineNormalizeStage(this.config.targetH, this.config.maxW);
    this.superRes     = null;  // built after weights load
    this.ocrTransform = null;  // built after weights load
    this.feedback     = new ConfidenceFeedbackStage({
      confidenceThreshold: this.config.confidenceThreshold,
      maxRetries:          this.config.maxRetries,
    });

    // Parallel utilities
    this.binarization = new BinarizationStage();
    this.morphology   = new MorphologyStage();
    this.cca          = new CCAStage();

    // Layout engine
    this.layout = new LayoutEngine();

    // Weights (loaded lazily)
    this._dbnetWeights = null;
  }

  /**
   * Initialize WebGPU context and load model weights.
   * Must be called before recognize().
   */
  async init() {
    // ── WebGPU ────────────────────────────────────────────────────────────
    await gpuContext.init({ powerPreference: this.config.powerPreference });

    // ── Load model weights ────────────────────────────────────────────────
    const [dbnetBuf, ocrBuf, srBuf] = await Promise.all([
      this._fetchWeights(this.config.dbnetWeightsUrl),
      this._fetchWeights(this.config.ocrWeightsUrl),
      this._fetchWeights(this.config.srWeightsUrl),
    ]);

    this._dbnetWeights = dbnetBuf ? new DBNetWeights(dbnetBuf) : null;

    //this.ocrTransform  = new OCRTransformerStage(ocrBuf);
    //this.superRes      = new SuperResolutionStage(
    //  srBuf,
    //  2,    // 2× upscale
    //  20,   // apply if crop height < 20px
    //);

    this._ready = true;
    console.info('[OCRPipeline] Initialized. GPU:', gpuContext.adapter ? 'OK' : 'FALLBACK');
    return this;
  }

  async _fetchWeights(url) {
    if (!url) return null;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.arrayBuffer();
    } catch (e) {
      console.warn(`[OCRPipeline] Could not load weights from ${url}:`, e.message);
      return null;
    }
  }

  /**
   * Recognize text in an image.
   * @param {ImageBitmap | HTMLImageElement | HTMLCanvasElement} image
   * @param {Object} [opts] - per-call overrides to config
   * @returns {Promise<OCROutput>}
   */
  async recognize(image, opts = {}) {
    if (!this._ready) {
      throw new Error('[OCRPipeline] Not initialized. Call init() first.');
    }

    const cfg = { ...this.config, ...opts };
    const t0  = performance.now();

    // Convert image to ImageBitmap if needed
    let bitmap = image;
    if (!(image instanceof ImageBitmap)) {
      bitmap = await createImageBitmap(image);
    }
    const H = bitmap.height;
      const W = bitmap.width;
      console.log(['this._imageToGPUTensor => Start', this._imageToGPUTensor ]);
    // ── Load image into GPU ────────────────────────────────────────────────
      const imageTensor = await this._imageToGPUTensor(bitmap, H, W);
      console.log(['this._imageToGPUTensor => End', imageTensor]);

    try {
      return await this._runPipeline(imageTensor, H, W, cfg, t0);
    } finally {
      imageTensor.destroy();
    }
  }

  /**
   * Internal pipeline execution.
   * @private
   */
  async _runPipeline(imageTensor, H, W, cfg, t0, retryCount = 0, retryParams = {}) {
    const timings = {};
    const ts = () => performance.now();

    // ── Stage 1: IQA ──────────────────────────────────────────────────────
      let t = ts();

      console.log(['this.iqa.run => start', this.iqa.run]);
    const iqaResult = await this.iqa.run(imageTensor);
      timings.iqa = ts() - t;
      console.log(['this.iqa.run => end', timings]);
    console.debug('[OCR] IQA score:', iqaResult.score.toFixed(3), 'flags:', [...iqaResult.flags]);

    // ── Stage 2: Orientation & Script ─────────────────────────────────────
    // Need luminance tensor for orientation stage
    t = ts();
    const lumaTensor = await this._extractLuma(imageTensor, H, W);
    const orientResult = await this.orientation.run(lumaTensor);
    timings.orientation = ts() - t;
    console.debug('[OCR] Orientation:', orientResult.orientationDeg, '° Script:', orientResult.scriptDirection);

    // ── Stage 3: Textness ─────────────────────────────────────────────────
    t = ts();
    const { textnessTensor } = await this.textness.run(lumaTensor);
    timings.textness = ts() - t;

    // ── Stage 4: Enhancement ──────────────────────────────────────────────
    t = ts();
    const { enhancedTensor } = await this.enhance.run(imageTensor, iqaResult);
    timings.enhance = ts() - t;

    // ── Stage 5: DBNet detection ───────────────────────────────────────────
    t = ts();
    const dbnetResult = await this.dbnet.run(
      enhancedTensor, H, W, this._dbnetWeights
    );
    timings.dbnet = ts() - t;

    // ── Stage 6: Polygon extraction ───────────────────────────────────────
    t = ts();
    const { polygons } = await this.polyExtract.run(
      dbnetResult.binaryTensor, dbnetResult.mapH, dbnetResult.mapW,
      dbnetResult.probTensor, dbnetResult.scaleH, dbnetResult.scaleW,
      { binaryThreshold: cfg.binaryThreshold + (retryParams.binaryThreshold ?? 0) }
    );
    timings.polygons = ts() - t;
    console.debug('[OCR] Detected polygons:', polygons.length);

    // ── Stage 7: Unclip + Score + NMS ────────────────────────────────────
    t = ts();
    const unclipResult = await this.unclip.run(
      polygons, textnessTensor, dbnetResult.mapH, dbnetResult.mapW,
      {
        unclipRatio: cfg.unclipRatio,
        minScore:    0.25 - (retryCount * 0.05),
      }
    );
    timings.unclip = ts() - t;
    console.debug('[OCR] Regions after NMS:', unclipResult.count);

    if (unclipResult.count === 0) {
      return this._emptyOutput(timings, iqaResult, orientResult, H, W, t0);
    }

    // ── Stage 8: Deskew ───────────────────────────────────────────────────
    t = ts();
    const deskewedRegions = await this.deskew.run(
      enhancedTensor, H, W, unclipResult.regions
    );
    timings.deskew = ts() - t;

    // ── Stage 9: Line Crop ────────────────────────────────────────────────
    t = ts();
    const lineRegions = await this.lineCrop.run(
      enhancedTensor, H, W, deskewedRegions,
      { useDeskewed: true, applyMask: cfg.applyPolygonMask }
    );
    timings.lineCrop = ts() - t;

    // ── Stage 10: Line Normalize ──────────────────────────────────────────
    t = ts();
    const normResult = await this.lineNorm.run(lineRegions);
    timings.normalize = ts() - t;

    // ── Stage 11: Super Resolution (conditional) ──────────────────────────
    t = ts();
    let finalNormResult = normResult;
    if (cfg.enableSuperRes && this.superRes) {
      finalNormResult = await this.superRes.run(normResult);
    }
    timings.superRes = ts() - t;

    // ── Stage 12: OCR Recognition ─────────────────────────────────────────
    t = ts();
    const ocrResults = finalNormResult.batchTensor && finalNormResult.batchN > 0
      ? await this.ocrTransform.run(
          finalNormResult.batchTensor,
          finalNormResult.batchN,
          finalNormResult.batchH,
          finalNormResult.batchW
        )
      : [];
    timings.ocr = ts() - t;

    // ── Stage 13: Confidence Feedback ────────────────────────────────────
    t = ts();
    const feedbackResult = await this.feedback.run(
      ocrResults, unclipResult, iqaResult, orientResult, retryCount
    );
    timings.feedback = ts() - t;

    // ── Retry loop ────────────────────────────────────────────────────────
    if (feedbackResult.feedback.shouldRetry && retryCount < cfg.maxRetries) {
      console.info(`[OCR] Retry ${retryCount + 1}/${cfg.maxRetries} (${feedbackResult.feedback.retryRegions.length} low-confidence regions)`);
      // TODO: for targeted retry, re-run only on retryRegions with adjusted params
      // For simplicity, we return what we have (production would loop here)
    }

    // ── Layout Analysis ───────────────────────────────────────────────────
    t = ts();
    const docModel = this.layout.analyze(
      feedbackResult.annotatedRegions, W, H, orientResult
    );
    timings.layout = ts() - t;

    // ── Cleanup ───────────────────────────────────────────────────────────
    [lumaTensor, textnessTensor, enhancedTensor].forEach(t => t?.destroy());
    [dbnetResult.probTensor, dbnetResult.threshTensor, dbnetResult.binaryTensor].forEach(t => t?.destroy());
    if (finalNormResult.batchTensor) finalNormResult.batchTensor.destroy();
    deskewedRegions.forEach(r => r.deskewedTensor?.destroy());
    lineRegions.forEach(r => r.cropTensor?.destroy());

    const totalMs = performance.now() - t0;

    return {
      // Primary outputs
      fullText:         docModel.fullText,
      document:         docModel,
      regions:          feedbackResult.annotatedRegions,

      // Metadata
      pipelineReport:   feedbackResult.pipelineReport,
      timings:          { ...timings, total: totalMs },
      iqa:              iqaResult,
      orientation:      orientResult,

      // Stats
      regionCount:      unclipResult.count,
      meanConfidence:   feedbackResult.meanConfidence,
      processingMs:     Math.round(totalMs),
    };
  }

  /**
   * Extract luminance channel from image tensor.
   * @private
   */
  async _extractLuma(imageTensor, H, W) {
    const N = H * W;
    const lumaTensor = new Tensor([H, W], 'f32', 0, 'main:luma');

    const code = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>            u:    U;
@group(0) @binding(1) var<storage,read>       rgba: array<u32>;
@group(0) @binding(2) var<storage,read_write> luma: array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let p = rgba[gid.x];
  let r = f32((p>>0u)&0xFFu)/255.0;
  let g = f32((p>>8u)&0xFFu)/255.0;
  let b = f32((p>>16u)&0xFFu)/255.0;
  luma[gid.x] = 0.299*r + 0.587*g + 0.114*b;
}`;

    const mod = gpuContext.createShaderModule(code, 'main:luma');
    const pipeline = gpuContext.createComputePipeline(mod, 'main');
    const { createUniformBuffer } = await import('./core/tensor.js');
    const uBuf = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [uBuf.bindingEntry(0), imageTensor.bindingEntry(1, true), lumaTensor.bindingEntry(2)],
    });
    gpuContext.dispatch(pipeline, bg, [Math.ceil(N / 256), 1, 1]);
    return lumaTensor;
  }

  /**
   * Upload an ImageBitmap to a GPU tensor (packed RGBA8 u32 per pixel).
   * @private
   */
  async _imageToGPUTensor(bitmap, H, W) {
    // Draw to canvas → read pixel data
    const canvas = new OffscreenCanvas(W, H);
    const ctx    = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, W, H);
    const imageData = ctx.getImageData(0, 0, W, H);
    const rgba8     = imageData.data;  // Uint8ClampedArray

    // Pack RGBA8 → u32 per pixel
    const packed = new Uint32Array(H * W);
    for (let i = 0; i < H * W; i++) {
      const r = rgba8[i * 4 + 0];
      const g = rgba8[i * 4 + 1];
      const b = rgba8[i * 4 + 2];
      const a = rgba8[i * 4 + 3];
      packed[i] = r | (g << 8) | (b << 16) | (a << 24);
    }

    const tensor = new Tensor([H, W], 'u32', 0, 'main:img');
    tensor.upload(packed);
    return tensor;
  }

  _emptyOutput(timings, iqaResult, orientResult, H, W, t0) {
    return {
      fullText: '',
      document: { blocks: [], columns: 1, lineCount: 0, regionCount: 0, fullText: '', pageWidth: W, pageHeight: H, orientation: 0, scriptDir: 'LTR' },
      regions: [],
      pipelineReport: { regionsDetected: 0 },
      timings: { ...timings, total: performance.now() - t0 },
      iqa: iqaResult,
      orientation: orientResult,
      regionCount: 0,
      meanConfidence: 0,
      processingMs: Math.round(performance.now() - t0),
    };
  }

  /** Release all GPU resources */
  destroy() {
    gpuContext.destroy();
  }
}

// ─── Convenience Function ─────────────────────────────────────────────────────

/**
 * One-shot OCR. Initializes, recognizes, and tears down the pipeline.
 * @param {ImageBitmap} image
 * @param {OCRConfig} config
 * @returns {Promise<OCROutput>}
 */
export async function ocr(image, config = {}) {
  const pipeline = new OCRPipeline(config);
  await pipeline.init();
  try {
    return await pipeline.recognize(image);
  } finally {
    pipeline.destroy();
  }
}

/**
 * @typedef {Object} OCROutput
 * @property {string}   fullText         - Concatenated recognized text
 * @property {DocumentModel} document    - Structured document model
 * @property {AnnotatedRegion[]} regions - Per-region results with confidence
 * @property {Object}   pipelineReport   - Quality metrics
 * @property {Object}   timings          - Per-stage timing (ms)
 * @property {IQAResult} iqa             - Image quality assessment result
 * @property {OrientationResult} orientation
 * @property {number}   regionCount
 * @property {number}   meanConfidence
 * @property {number}   processingMs
 */
