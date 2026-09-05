/**
 * GRIDLIFT - "where are things?"
 *
 *   invoice image -> normalised geometry -> line/text primitives
 *                 -> candidate grids -> cells -> geometry graph
 *
 * Stages 01-12 run as GPU compute passes (pipeline.js); 13-15 are CPU work
 * over the compacted results. The public surface is one call.
 */

import { GridliftGpu } from './pipeline.js';
import { resolveConfig } from './config.js';
import {
  decodeComponents, extractSegments, annotateSegments, clusterLines, estimateSkew, groupWords,
} from './geometry.js';
import { findTableBands, buildHypotheses } from './grid.js';
import { buildCells, summariseCells, geometryConfidence, buildGeometryGraph } from './cells.js';
import { StageLog } from '../gpu/passes.js';
import { estimateRectification, needsRectification } from './rectify/index.js';

export { GridliftGpu } from './pipeline.js';
export { DEFAULT_CONFIG, resolveConfig } from './config.js';
export * from './geometry.js';
export * from './grid.js';
export * from './cells.js';
export * from './rectify/index.js';

export class Gridlift {
  constructor(gpu, config) {
    this.gpu = gpu;
    this.config = config;
  }

  static async create(config = {}) {
    const cfg = resolveConfig(config);
    return new Gridlift(await GridliftGpu.create(cfg), cfg);
  }

  destroy() {
    this.gpu.destroy();
  }

  /**
   * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas} source
   * @param {{rectify?: boolean|'auto'}} [options]
   *   'auto' (the default) runs a cheap geometry-only first pass, estimates the
   *   page plane from the components it finds, and re-runs through the
   *   rectifying homography only if the page actually needs it. `false` skips
   *   the estimate entirely; `true` forces the second pass.
   */
  async analyse(source, options = {}) {
    const mode = options.rectify ?? this.config.rectify?.mode ?? 'auto';
    const raw = await this.gpu.runGpuStages(source);
    if (mode === false) return analyseGeometry(raw, this.config);

    const first = decodeGeometry(raw, this.config);
    const est = estimateRectification(
      raw, first.components, { hSegs: first.hSegs, vSegs: first.vSegs },
      { maxDim: Math.max(raw.imageWidth ?? raw.sourceWidth, raw.imageHeight ?? raw.sourceHeight) },
    );

    if (!est.ok || (mode === 'auto' && !needsRectification(est))) {
      const out = analyseGeometry(raw, this.config, first);
      out.geometry.image.rectification = { applied: false, ...summariseEstimate(est) };
      out.rectification = est;
      return out;
    }

    const raw2 = await this.gpu.runGpuStages(source, {
      rectify: { H: est.H, width: est.width, height: est.height },
    });
    const out = analyseGeometry(raw2, this.config);
    out.geometry.image.rectification = { applied: true, ...summariseEstimate(est) };
    out.rectification = est;
    return out;
  }
}

const summariseEstimate = (est) => ({
  quarterTurns: est.quarterTurns,
  skewDeg: est.skewDeg,
  method: est.method,
  quality: est.quality,
  /** rectified -> original source pixels, for cropping ROIs from the original. */
  Hinv: est.ok ? Array.from(est.Hinv) : null,
  H: est.ok ? Array.from(est.H) : null,
  diagnostics: est.diagnostics,
});

/**
 * Decode the compacted GPU output into components, rules and text lines.
 * Split out because the rectification pre-pass needs exactly this and nothing
 * more - there is no point building grid hypotheses on a page that is about to
 * be re-projected.
 */
export function decodeGeometry(raw, config = {}) {
  const cfg = resolveConfig(config);
  const components = raw.components ?? decodeComponents(
    raw.componentsRaw, raw.componentCount, raw.componentStride, {
      width: raw.width,
      height: raw.height,
      minArea: cfg.cca.minArea,
      maxHeightRatio: cfg.cca.maxHeightRatio,
    });
  const hSegs = extractSegments(raw.packed, raw.width, raw.height, 'h', {
    minLength: Math.max(24, raw.width * cfg.strokes.minLenRatioH),
  });
  const vSegs = extractSegments(raw.packed, raw.width, raw.height, 'v', {
    minLength: Math.max(20, raw.height * cfg.strokes.minLenRatioV),
  });
  annotateSegments(hSegs, vSegs, raw.width, raw.height);
  const lines = clusterLines(components);
  for (const L of lines) L.words = groupWords(L);
  const skew = estimateSkew(raw.angleHistogram, cfg.gradient.histBins);
  return { components, hSegs, vSegs, lines, skew };
}

/**
 * Stages 13-15 over the compacted GPU output. Separated from the GPU class so
 * it can be driven from a synthetic mask buffer in tests, and so a host that
 * runs the GPU pass elsewhere (a worker, a native .NET WebGPU host) can call
 * just this half.
 *
 * @param {object} raw    result of GridliftGpu.runGpuStages
 * @param {object} config resolved config
 */
export function analyseGeometry(raw, config = {}, decoded = null) {
    const cfg = resolveConfig(config);
    const log = new StageLog();

    // --- decode GPU output ---------------------------------------------
    log.start(13, 'segments+components');
    const { components, hSegs, vSegs, lines, skew } = decoded ?? decodeGeometry(raw, cfg);
    log.stop({ components: components.length, hSegs: hSegs.length, vSegs: vSegs.length, lines: lines.length });

    // --- stage 13: bands + hypotheses ------------------------------------
    log.start(14, 'grid-hypotheses');
    const ctx = {
      packed: raw.packed,
      width: raw.width,
      height: raw.height,
      scale: raw.scale,
      hSegs,
      vSegs,
      components,
      lines,
    };
    const bands = findTableBands(lines, {
      width: raw.width,
      tolRatio: cfg.hypotheses.mergeRatio,
      minColumns: cfg.hypotheses.minColumns,
      minRows: cfg.hypotheses.minRows,
    });

    const tables = [];
    for (const band of bands.slice(0, 4)) {
      const ranked = buildHypotheses(band, ctx, cfg);
      if (!ranked.length) continue;
      const best = ranked[0];
      const table = buildCells(best, band, ctx);
      const summary = summariseCells(table);
      tables.push({
        ...table,
        borderless: best.parts.lineEvidence < 0.25,
        evidence: best.source,
        rowEvidence: best.rowSource,
        score: best.score,
        parts: best.parts,
        summary,
        confidence: geometryConfidence(ranked, summary),
        alternatives: ranked.slice(1, 4).map((r) => ({
          source: r.source, score: r.score, cols: r.cols, rows: r.rows,
        })),
      });
    }
    tables.sort((a, b) => b.cells.length * b.confidence - a.cells.length * a.confidence);
    log.stop({ bands: bands.length, tables: tables.length });

    const geometry = buildGeometryGraph({
      gpu: raw,
      segments: { hSegs, vSegs },
      components,
      lines,
      bands,
      tables,
      skew,
      timings: {
        gpu: raw.stages,
        cpu: log.stages,
        gpuMs: raw.gpuMs,
        cpuMs: log.totalMs,
        totalMs: +(raw.gpuMs + log.totalMs).toFixed(2),
      },
    });

    geometry.confidence = tables.length
      ? +Math.max(...tables.map((t) => t.confidence)).toFixed(4)
      : 0;
    geometry.warnings = collectWarnings(raw, skew, tables);

    return { geometry, raw, ctx };
}

function collectWarnings(raw, skew, tables) {
  const w = [];
  if (raw.overflow) w.push('component-capacity-exceeded: raise cca.capacity or lower workingMaxDim');
  if (Math.abs(skew.skewDeg) > 0.75) w.push(`page-skew ${skew.skewDeg.toFixed(2)}deg: deskew before re-running for reliable rules`);
  if (!tables.length) w.push('no-table-band-found');
  for (const t of tables) {
    if (t.parts.splitPenalty > 0.05) w.push(`column boundary crosses ${Math.round(t.parts.splitPenalty * 100)}% of words`);
  }
  return w;
}
