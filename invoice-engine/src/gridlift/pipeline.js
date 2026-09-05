/**
 * GRIDLIFT - stages 01..12 on the GPU.
 *
 * The whole point of the design: the invoice is uploaded once, every
 * intermediate stays in GPU storage, and exactly one full-resolution buffer
 * comes back to the CPU (the packed mask). Everything else that crosses the
 * bus is already compacted - a component table, four projection profiles, an
 * orientation histogram. On a 12 MP page that is ~10 MB of readback instead of
 * ~600 MB of round trips.
 *
 * Stages 13-15 (grid hypotheses, cell reconstruction, confidence) are CPU work
 * over that compacted data and live in ./grid.js and ./cells.js.
 */

import { GpuContext } from '../gpu/device.js';
import { BufferPool, ParamsRing, readback, STORAGE_USAGE } from '../gpu/buffers.js';
import { PassRunner, StageLog } from '../gpu/passes.js';
import { resolveConfig } from './config.js';
import {
  RESAMPLE, LUMINANCE, BOX_STATS_X, SAUVOLA_Y, MEDIAN3, SCHARR, ANGLE_HIST,
} from './shaders/preprocess.js';
import {
  MORPH_1D, STROKE_SCORE, BINARIZE, COMBINE_MAX, SUPPRESS_BORDERS, PACK_MASKS, FILL_U32,
} from './shaders/morphology.js';
import {
  CCA_INIT, CCA_LINK, CCA_COMPRESS, CCA_COMPACT, CCA_ACCUMULATE, CCA_RESET_COMPS,
} from './shaders/cca.js';
import { PROJECTIONS } from './shaders/projections.js';

const AXIS_X = 0, AXIS_Y = 1;
const ERODE = 0, DILATE = 1;
const COMP_STRIDE = 8;

export class GridliftGpu {
  /** @param {GpuContext} ctx */
  constructor(ctx, config = {}) {
    this.ctx = ctx;
    this.device = ctx.device;
    this.config = resolveConfig(config);
    this.pool = new BufferPool(this.device);
    this.params = new ParamsRing(this.device, 256);
  }

  static async create(config = {}) {
    return new GridliftGpu(await GpuContext.create(), config);
  }

  destroy() {
    this.pool.destroy();
    this.ctx.destroy();
  }

  /** Working resolution: preserve aspect, cap the long edge, keep it even. */
  workingSize(srcW, srcH) {
    const cap = this.config.workingMaxDim;
    const scale = Math.min(1, cap / Math.max(srcW, srcH));
    const w = Math.max(16, Math.round(srcW * scale) & ~1);
    const h = Math.max(16, Math.round(srcH * scale) & ~1);
    return { w, h, scale: w / srcW };
  }

  /**
   * Stages 01..12.
   * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas|VideoFrame} source
   * @returns {Promise<object>} raw geometry evidence for the CPU stages
   */
  async runGpuStages(source) {
    const cfg = this.config;
    const log = new StageLog();
    const dev = this.device;
    const pool = this.pool;
    this.params.rewind();

    const srcW = source.width ?? source.codedWidth;
    const srcH = source.height ?? source.codedHeight;
    const { w, h, scale } = this.workingSize(srcW, srcH);
    const px = w * h;
    const F32 = px * 4;
    const U32 = px * 4;

    // ---------------- Stage 01: upload -----------------------------------
    log.start(1, 'upload');
    const tex = dev.createTexture({
      label: 'invoice-source',
      size: [srcW, srcH, 1],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    dev.queue.copyExternalImageToTexture(
      { source, flipY: false },
      { texture: tex, premultipliedAlpha: false },
      [srcW, srcH],
    );
    const texView = tex.createView();
    log.stop({ srcW, srcH, workW: w, workH: h, scale: +scale.toFixed(4) });

    const runner = new PassRunner(this.ctx, this.params).begin('gridlift');
    const grid2d = { x: w, y: h, wgx: 8, wgy: 8 };
    const base = { w, h };

    const morph = (src, dst, axis, op, radius) =>
      runner.run('morph1d', MORPH_1D, { ...base, i0: axis, i1: op, i2: Math.max(0, radius | 0) }, [src, dst], grid2d);

    // ---------------- Stage 02: decode / normalise ------------------------
    log.start(2, 'decode+normalise');
    const rgba = pool.acquire(U32, STORAGE_USAGE, 'rgba');
    runner.run('resample', RESAMPLE, {
      ...base, i0: srcW, i1: srcH, i2: cfg.resampleTaps,
      f0: cfg.normalise.gain, f1: cfg.normalise.bias,
    }, [texView, rgba], grid2d);
    log.stop();

    // ---------------- Stage 03: luminance ---------------------------------
    log.start(3, 'luminance');
    const lum = pool.acquire(F32, STORAGE_USAGE, 'lum');
    runner.run('luminance', LUMINANCE, base, [rgba, lum], grid2d);
    log.stop();

    // ---------------- Stage 04: adaptive contrast -------------------------
    log.start(4, 'adaptive-contrast');
    const radius = Math.round(
      Math.min(cfg.sauvola.maxRadius,
        Math.max(cfg.sauvola.minRadius, Math.max(w, h) * cfg.sauvola.radiusRatio)),
    );
    const sumX = pool.acquire(F32, STORAGE_USAGE, 'sumX');
    const sumSq = pool.acquire(F32, STORAGE_USAGE, 'sumSq');
    const ink = pool.acquire(F32, STORAGE_USAGE, 'ink');
    runner.run('boxStatsX', BOX_STATS_X, { ...base, i0: radius }, [lum, sumX, sumSq], grid2d);
    runner.run('sauvolaY', SAUVOLA_Y, {
      ...base, i0: radius,
      f0: cfg.sauvola.k, f1: cfg.sauvola.R,
      f2: cfg.sauvola.softness, f3: cfg.sauvola.minStdDev,
    }, [sumX, sumSq, lum, ink], grid2d);
    pool.release(sumX, sumSq);
    log.stop({ radius });

    // ---------------- Stage 05: denoise -----------------------------------
    log.start(5, 'denoise');
    let inkBuf = ink;
    if (cfg.denoise.enabled) {
      const den = pool.acquire(F32, STORAGE_USAGE, 'inkDenoised');
      runner.run('median3', MEDIAN3, base, [ink, den], grid2d);
      pool.release(ink);
      inkBuf = den;
    }
    log.stop();

    // ---------------- Stage 06: gradients + skew --------------------------
    log.start(6, 'gradients');
    const mag = pool.acquire(F32, STORAGE_USAGE, 'gradMag');
    const ang = pool.acquire(F32, STORAGE_USAGE, 'gradAng');
    const bins = cfg.gradient.histBins;
    const hist = pool.acquire(bins * 4, STORAGE_USAGE, 'angleHist');
    runner.run('scharr', SCHARR, base, [lum, mag, ang], grid2d);
    runner.run1D('fillU32', FILL_U32, { w: bins, h: 1, i0: 0 }, [hist], bins);
    runner.run('angleHist', ANGLE_HIST, {
      ...base, i0: bins, f0: cfg.gradient.magThreshold,
    }, [mag, ang, hist], { x: w, y: h, wgx: 16, wgy: 16 });
    pool.release(lum, mag, ang, rgba);
    log.stop();

    // ---------------- Stages 07/08/09: strokes ----------------------------
    // Directional opening isolates long runs; directional closing bridges the
    // gaps that dashed and badly-scanned rules leave; the crowding damp keeps
    // dense text from masquerading as a rule.
    const tA = pool.acquire(F32, STORAGE_USAGE, 'morphA');
    const tB = pool.acquire(F32, STORAGE_USAGE, 'morphB');
    const hMask = pool.acquire(F32, STORAGE_USAGE, 'hMask');
    const vMask = pool.acquire(F32, STORAGE_USAGE, 'vMask');

    const rH = Math.max(3, Math.round((w * cfg.strokes.minLenRatioH) / 2));
    const rV = Math.max(3, Math.round((h * cfg.strokes.minLenRatioV) / 2));
    const gH = Math.max(1, Math.round((w * cfg.strokes.linkGapRatioH) / 2));
    const gV = Math.max(1, Math.round((h * cfg.strokes.linkGapRatioV) / 2));

    log.start(7, 'horizontal-strokes');
    morph(inkBuf, tA, AXIS_X, ERODE, rH);
    morph(tA, tB, AXIS_X, DILATE, rH);
    log.stop({ minLenPx: rH * 2 + 1 });

    log.start(9, 'stroke-linking(H)');
    morph(tB, tA, AXIS_X, DILATE, gH);
    morph(tA, tB, AXIS_X, ERODE, gH);
    log.stop({ maxGapPx: gH * 2 + 1 });

    runner.run('strokeScore', STROKE_SCORE, {
      ...base, i0: 0, i2: cfg.strokes.crowdingProbe, f0: cfg.strokes.crowdingDamp,
    }, [tB, inkBuf, tA], grid2d);
    runner.run('binarize', BINARIZE, { ...base, f0: cfg.strokes.threshold }, [tA, hMask], grid2d);

    log.start(8, 'vertical-strokes');
    morph(inkBuf, tA, AXIS_Y, ERODE, rV);
    morph(tA, tB, AXIS_Y, DILATE, rV);
    morph(tB, tA, AXIS_Y, DILATE, gV);
    morph(tA, tB, AXIS_Y, ERODE, gV);
    runner.run('strokeScore', STROKE_SCORE, {
      ...base, i0: 1, i2: cfg.strokes.crowdingProbe, f0: cfg.strokes.crowdingDamp,
    }, [tB, inkBuf, tA], grid2d);
    runner.run('binarize', BINARIZE, { ...base, f0: cfg.strokes.threshold }, [tA, vMask], grid2d);
    log.stop({ minLenPx: rV * 2 + 1 });

    // ---------------- Stage 10: border suppression ------------------------
    log.start(10, 'border-suppression');
    const stroke = pool.acquire(F32, STORAGE_USAGE, 'stroke');
    const ocrInk = pool.acquire(F32, STORAGE_USAGE, 'ocrInk');
    runner.run('combineMax', COMBINE_MAX, base, [hMask, vMask, stroke], grid2d);
    const d = cfg.suppress.dilate;
    morph(stroke, tA, AXIS_X, DILATE, d);
    morph(tA, tB, AXIS_Y, DILATE, d);
    runner.run('suppress', SUPPRESS_BORDERS, { ...base, f0: cfg.suppress.strength },
      [inkBuf, tB, ocrInk], grid2d);
    log.stop();

    // ---------------- Stage 11: connected components ----------------------
    log.start(11, 'connected-components');
    const cap = cfg.cca.capacity;
    const label = pool.acquire(U32, STORAGE_USAGE, 'labels');
    const cmap = pool.acquire(U32, STORAGE_USAGE, 'labelMap');
    const comps = pool.acquire(cap * COMP_STRIDE * 4, STORAGE_USAGE, 'components');
    const counter = pool.acquire(16, STORAGE_USAGE, 'compCounter');
    const flag = pool.acquire(16, STORAGE_USAGE, 'ccaFlag');

    runner.run1D('fillU32', FILL_U32, { w: px, h: 1, i0: 0xffffffff }, [cmap], px);
    runner.run1D('fillU32', FILL_U32, { w: 4, h: 1, i0: 0 }, [counter], 4);
    runner.run1D('fillU32', FILL_U32, { w: 4, h: 1, i0: 0 }, [flag], 4);
    runner.run1D('ccaResetComps', CCA_RESET_COMPS, { w: cap, h: 1 }, [comps], cap);

    runner.run('ccaInit', CCA_INIT, { ...base, f0: cfg.cca.threshold }, [label, ocrInk], grid2d);
    for (let it = 0; it < cfg.cca.iterations; it++) {
      runner.run('ccaLink', CCA_LINK, base, [label, flag], grid2d);
      runner.run('ccaCompress', CCA_COMPRESS, base, [label], grid2d);
    }
    runner.run('ccaCompact', CCA_COMPACT, { ...base, i0: cap },
      [label, cmap, counter, comps], grid2d);
    runner.run('ccaAccumulate', CCA_ACCUMULATE, { ...base, i0: cap },
      [label, cmap, comps, ocrInk, stroke], grid2d);
    log.stop({ capacity: cap, iterations: cfg.cca.iterations });

    // ---------------- Stage 12: projections -------------------------------
    log.start(12, 'projections');
    const rowInk = pool.acquire(h * 4, STORAGE_USAGE, 'rowInk');
    const colInk = pool.acquire(w * 4, STORAGE_USAGE, 'colInk');
    const rowStroke = pool.acquire(h * 4, STORAGE_USAGE, 'rowStroke');
    const colStroke = pool.acquire(w * 4, STORAGE_USAGE, 'colStroke');
    for (const [b, n] of [[rowInk, h], [colInk, w], [rowStroke, h], [colStroke, w]]) {
      runner.run1D('fillU32', FILL_U32, { w: n, h: 1, i0: 0 }, [b], n);
    }
    runner.run('projections', PROJECTIONS, base,
      [ocrInk, stroke, rowInk, colInk, rowStroke, colStroke],
      { x: w, y: h, wgx: 16, wgy: 16 });
    log.stop();

    // ---------------- Pack + readback -------------------------------------
    log.start(0, 'pack+readback');
    const packed = pool.acquire(U32, STORAGE_USAGE, 'packedMasks');
    runner.run('packMasks', PACK_MASKS, base, [inkBuf, hMask, vMask, ocrInk, packed], grid2d);
    runner.end();

    // The component counter comes back first so only the *used* prefix of the
    // 2 MB component table is transferred - a near-empty page then costs a few
    // hundred bytes instead of the whole capacity.
    const counterBytes = await readback(dev, counter, 4);
    const emitted = new Uint32Array(counterBytes)[0];
    const componentCount = Math.min(emitted, cap);
    const compBytesNeeded = Math.max(256, componentCount * COMP_STRIDE * 4);

    const [packedBytes, compBytes, riBytes, ciBytes, rsBytes, csBytes, histBytes] =
      await Promise.all([
        readback(dev, packed, U32),
        readback(dev, comps, compBytesNeeded),
        readback(dev, rowInk, h * 4),
        readback(dev, colInk, w * 4),
        readback(dev, rowStroke, h * 4),
        readback(dev, colStroke, w * 4),
        readback(dev, hist, bins * 4),
      ]);
    log.stop({ bytes: U32 + compBytesNeeded, components: componentCount });

    tex.destroy();
    pool.reset();

    return {
      width: w,
      height: h,
      sourceWidth: srcW,
      sourceHeight: srcH,
      scale,
      packed: new Uint32Array(packedBytes),
      componentsRaw: new Uint32Array(compBytes),
      componentCount,
      componentCapacity: cap,
      componentStride: COMP_STRIDE,
      projections: {
        rowInk: new Uint32Array(riBytes),
        colInk: new Uint32Array(ciBytes),
        rowStroke: new Uint32Array(rsBytes),
        colStroke: new Uint32Array(csBytes),
      },
      angleHistogram: new Uint32Array(histBytes),
      strokeParams: { rH, rV, gH, gV },
      stages: log.stages,
      gpuMs: log.totalMs,
      overflow: emitted > cap,
    };
  }
}

/** Mask byte lanes inside the packed u32. */
export const LANE = { INK: 0, H: 8, V: 16, OCR: 24 };
export const laneAt = (packed, i, lane) => (packed[i] >>> lane) & 0xff;
