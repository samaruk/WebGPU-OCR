/**
 * preprocessing/preprocessing.js
 * Advanced OCR preprocessing pipeline (WebGPU).
 *
 * Passes (all in preprocessing.wgsl):
 *  0. grayscalePass    — BT.709 luma
 *  1a. claheHistPass   — per-tile histogram (workgroup atomics)
 *  1b. claheLUTPass    — clip + CDF → LUT (parallel prefix sum)
 *  1c. claheApplyPass  — bilinear LUT interpolation → CLAHE-enhanced grey
 *  2.  guidedFilterPass — edge-preserving denoising
 *  3.  sauvolaPass     — locally adaptive binarization
 */

import {
  loadShader,
  createStorageBuffer,
  createUniformBuffer,
  buildUniforms,
  readbackBuffer,
  dispatchCompute,
  imageToFloat32,
  renderGray,
} from '../utils/webgpu-utils.js';

const WGSL_PATH   = './preprocessing/preprocessing.wgsl';
const WG          = 16;    // standard workgroup tile size (16×16)
const NUM_TILES_X = 8;     // CLAHE tile grid
const NUM_TILES_Y = 8;
const CLAHE_CLIP  = 2.5;   // clip-limit multiplier (higher → stronger contrast)
const GUIDED_EPS  = 0.01;  // guided filter epsilon (higher → more smoothing)
const GUIDED_R    = 7;     // guided filter radius (pixels)
const SAUVOLA_WIN = 15;    // Sauvola half-window (31×31 kernel)
const SAUVOLA_K   = 0.34;  // Sauvola sensitivity
const SAUVOLA_R   = 0.5;   // Sauvola R (max σ for [0,1] images)

export class PreprocessingPipeline {
  constructor(device) { this.device = device; this._ready = false; }

  // ── Init: compile shader, create 6 compute pipelines ─────────────────────
  async init() {
    const { device } = this;
    const shader = await loadShader(device, WGSL_PATH);
    const mk = entry => device.createComputePipeline({
      label:   `prep::${entry}`,
      layout:  'auto',
      compute: { module: shader, entryPoint: entry },
    });
    this.pGray     = mk('grayscalePass');
    this.pClaheH   = mk('claheHistPass');
    this.pClaheLUT = mk('claheLUTPass');
    this.pClaheApp = mk('claheApplyPass');
    this.pGuided   = mk('guidedFilterPass');
    this.pSauvola  = mk('sauvolaPass');
    this._ready = true;
  }

  // ── Run: full pipeline on one image ──────────────────────────────────────
  /**
   * @param {HTMLImageElement} img
   * @param {{ original, gray, clahe, guided, binary }} canvases
   * @returns {{ grayData, claheData, guidedData, binaryData, width, height, timings }}
   */
  async run(img, canvases) {
    if (!this._ready) throw new Error('Call init() first.');
    const { device } = this;

    // ── Upload image ─────────────────────────────────────────────────────────
    const { pixels: rgba, width: W, height: H } = imageToFloat32(img, device);
    const N = W * H;

    // Draw original to canvas
    {
      canvases.original.width  = W;
      canvases.original.height = H;
      const ctx = canvases.original.getContext('2d');
      const id  = ctx.createImageData(W, H);
      for (let i = 0; i < N * 4; i++) id.data[i] = Math.round(rgba[i] * 255);
      ctx.putImageData(id, 0, 0);
    }

    // ── Uniform buffer (48 bytes) ─────────────────────────────────────────────
    const unifBytes = buildUniforms(
      { type: 'u32', value: W            },
      { type: 'u32', value: H            },
      { type: 'u32', value: NUM_TILES_X  },
      { type: 'u32', value: NUM_TILES_Y  },
      { type: 'f32', value: CLAHE_CLIP   },
      { type: 'f32', value: GUIDED_EPS   },
      { type: 'u32', value: GUIDED_R     },
      { type: 'u32', value: SAUVOLA_WIN  },
      { type: 'f32', value: SAUVOLA_K    },
      { type: 'f32', value: SAUVOLA_R    },
      { type: 'f32', value: 0            },
      { type: 'f32', value: 0            },
    );
    const unifBuf = createUniformBuffer(device, unifBytes);

    // ── Storage buffers ───────────────────────────────────────────────────────
    const rgbaBuf   = createStorageBuffer(device, N * 4, rgba);
    const grayBuf   = createStorageBuffer(device, N);
    const claheBuf  = createStorageBuffer(device, N);
    const guidedBuf = createStorageBuffer(device, N);
    const binaryBuf = createStorageBuffer(device, N);

    const numTiles  = NUM_TILES_X * NUM_TILES_Y;

    // Histogram: u32 per bin per tile (zero-initialised)
    const histBuf = device.createBuffer({
      size:  numTiles * 256 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(histBuf, 0, new Uint32Array(numTiles * 256));

    // LUT: f32 per bin per tile
    const lutBuf = createStorageBuffer(device, numTiles * 256);

    const dX = Math.ceil(W / WG);
    const dY = Math.ceil(H / WG);

    // Helper: create bind group from {pipelineObj, entries[]}
    const bg = (pl, entries) => device.createBindGroup({
      layout: pl.getBindGroupLayout(0),
      entries,
    });

    // ── Pass 0 : Grayscale ────────────────────────────────────────────────────
    const t0 = performance.now();
    dispatchCompute(device, this.pGray,
      bg(this.pGray, [
        { binding: 0, resource: { buffer: rgbaBuf  } },
        { binding: 1, resource: { buffer: grayBuf  } },
        { binding: 2, resource: { buffer: unifBuf  } },
      ]), dX, dY);
    const grayData = await readbackBuffer(device, grayBuf, N);
    renderGray(canvases.gray, grayData, W, H);
    const t1 = performance.now();

    // ── Pass 1a : CLAHE Histogram ─────────────────────────────────────────────
    dispatchCompute(device, this.pClaheH,
      bg(this.pClaheH, [
        { binding: 0, resource: { buffer: grayBuf  } },
        { binding: 2, resource: { buffer: unifBuf  } },
        { binding: 3, resource: { buffer: histBuf  } },
      ]), NUM_TILES_X, NUM_TILES_Y);

    // ── Pass 1b : CLAHE LUT ───────────────────────────────────────────────────
    dispatchCompute(device, this.pClaheLUT,
      bg(this.pClaheLUT, [
        { binding: 2, resource: { buffer: unifBuf  } },
        { binding: 3, resource: { buffer: histBuf  } },
        { binding: 4, resource: { buffer: lutBuf   } },
      ]), NUM_TILES_X, NUM_TILES_Y);

    // ── Pass 1c : CLAHE Apply ─────────────────────────────────────────────────
    dispatchCompute(device, this.pClaheApp,
      bg(this.pClaheApp, [
        { binding: 0, resource: { buffer: grayBuf  } },
        { binding: 1, resource: { buffer: claheBuf } },
        { binding: 2, resource: { buffer: unifBuf  } },
        { binding: 4, resource: { buffer: lutBuf   } },
      ]), dX, dY);
    const claheData = await readbackBuffer(device, claheBuf, N);
    renderGray(canvases.clahe, claheData, W, H);
    const t2 = performance.now();

    // ── Pass 2 : Guided Filter ────────────────────────────────────────────────
    dispatchCompute(device, this.pGuided,
      bg(this.pGuided, [
        { binding: 0, resource: { buffer: claheBuf  } },
        { binding: 1, resource: { buffer: guidedBuf } },
        { binding: 2, resource: { buffer: unifBuf   } },
      ]), dX, dY);
    const guidedData = await readbackBuffer(device, guidedBuf, N);
    renderGray(canvases.guided, guidedData, W, H);
    const t3 = performance.now();

    // ── Pass 3 : Sauvola Binarize ─────────────────────────────────────────────
    dispatchCompute(device, this.pSauvola,
      bg(this.pSauvola, [
        { binding: 0, resource: { buffer: guidedBuf } },
        { binding: 1, resource: { buffer: binaryBuf } },
        { binding: 2, resource: { buffer: unifBuf   } },
      ]), dX, dY);
    const binaryData = await readbackBuffer(device, binaryBuf, N);
    renderGray(canvases.binary, binaryData, W, H);
    const t4 = performance.now();

    // ── Cleanup ───────────────────────────────────────────────────────────────
    [rgbaBuf, grayBuf, claheBuf, guidedBuf, binaryBuf,
     histBuf, lutBuf, unifBuf].forEach(b => b.destroy());

    return {
      grayData, claheData, guidedData, binaryData,
      width: W, height: H,
      timings: {
        grayscale:    t1 - t0,
        clahe:        t2 - t1,
        guidedFilter: t3 - t2,
        sauvola:      t4 - t3,
        total:        t4 - t0,
      },
    };
  }
}
