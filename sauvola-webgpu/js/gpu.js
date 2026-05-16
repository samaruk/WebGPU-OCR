/**
 * @file gpu.js
 * @description WebGPU device init + the parallel Sauvola compute pipeline.
 *
 * Key optimisations vs the naive sequential version
 * ──────────────────────────────────────────────────
 *
 *  1. PARALLEL PREFIX SCAN (biggest win)
 *     Passes 2 and 3 each use three sub-passes (LOCAL → TILES → APPLY) that
 *     replace the old single-thread-per-row/column sequential scan:
 *
 *       Old  workgroup_size(1) × H/W rows/cols × W/H sequential ops each
 *       New  workgroup_size(256) × (H×tiles) workgroups × 8 parallel steps
 *            + workgroup_size(1) × H/W × numTiles sequential ops (3–23, not W/H)
 *
 *     For a 4000×3000 image this reduces sequential work by ≈ 250×.
 *
 *  2. PIPELINE CACHING
 *     Compiled GPUComputePipeline objects are expensive to create (~5–20 ms
 *     each).  We build them once on first call and reuse them for every
 *     subsequent run.  The cache is keyed on the GPU device object so it is
 *     automatically invalidated if the device is lost and re-created.
 *
 *  3. SINGLE COMMAND ENCODER
 *     All 8 compute passes + 2 buffer copies are recorded into one encoder
 *     and submitted together.  This minimises command-submission overhead
 *     and lets the GPU scheduler overlap passes.
 *
 * Pipeline pass sequence
 * ──────────────────────
 *  1   SH_GRAY       dispatch ceil(N/256), 1
 *  2a  SH_ROW_LOCAL  dispatch H, numColTiles
 *  2b  SH_ROW_TILES  dispatch H
 *  2c  SH_ROW_APPLY  dispatch H, numColTiles
 *  3a  SH_COL_LOCAL  dispatch W, numRowTiles
 *  3b  SH_COL_TILES  dispatch W
 *  3c  SH_COL_APPLY  dispatch W, numRowTiles
 *  4   SH_SAUVOLA    dispatch ceil(W/16), ceil(H/16)
 *
 * numColTiles = ceil(W/256),  numRowTiles = ceil(H/256)
 */

import {
  SH_GRAY,
  SH_ROW_LOCAL, SH_ROW_TILES, SH_ROW_APPLY,
  SH_COL_LOCAL, SH_COL_TILES, SH_COL_APPLY,
  SH_SAUVOLA,
} from './shaders.js';
import { SAUVOLA_R } from './config.js';

// ── MODULE STATE ──────────────────────────────────────────────────────────────

/** @type {GPUDevice|null} */
let gpu = null;

/**
 * Compiled pipeline cache.  Keyed by the GPUDevice object so it is
 * automatically stale after a device-lost event.
 *
 * @type {WeakMap<GPUDevice, Object>}
 */
const pipelineCache = new WeakMap();

// ── PUBLIC API ─────────────────────────────────────────────────────────────────

/**
 * Request a WebGPU device and compile all compute pipelines.
 *
 * Pipelines are compiled asynchronously by the driver in the background;
 * calling runSauvola() immediately after initGPU() is safe — the GPU will
 * execute the compiled versions when they are ready.
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If WebGPU is unavailable or no adapter is found.
 */
export async function initGPU() {
  if (!navigator.gpu) {
    throw new Error(
      'WebGPU not supported. Requires Chrome 113+ or Edge 113+ with hardware acceleration.'
    );
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) {
    throw new Error('No compatible WebGPU adapter found. Enable GPU acceleration in browser settings.');
  }
  gpu = await adapter.requestDevice();
  gpu.lost.then(info => { throw new Error('GPU device lost: ' + info.message); });

  // Eagerly compile all pipelines so the first runSauvola() call pays no
  // compilation cost (Chrome 113+ compiles async in the background).
  _getPipelines();
}

/**
 * Run the full 8-pass Sauvola binarisation pipeline.
 *
 * @async
 * @param {ImageData} imgData   Source image.
 * @param {number}    winSize   Sauvola window size (odd integer).
 * @param {number}    k         Sauvola k constant ∈ [0.05, 0.95].
 * @returns {Promise<{ binary: Uint32Array, gray: Float32Array, gpuMs: number }>}
 */
export async function runSauvola(imgData, winSize, k) {
  if (!gpu) throw new Error('Call initGPU() before runSauvola().');

  const W = imgData.width, H = imgData.height, N = W * H;
  const numColTiles = Math.ceil(W / 256);  // tile count for row scan
  const numRowTiles = Math.ceil(H / 256);  // tile count for column scan

  // ── Pack RGBA pixels → Uint32 ────────────────────────────────────────
  const px = packPixels(imgData);

  // ── Create GPU buffers ───────────────────────────────────────────────
  const S = GPUBufferUsage.STORAGE;
  const D = GPUBufferUsage.COPY_DST;
  const C = GPUBufferUsage.COPY_SRC;
  const R = GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ;

  /** @param {number} usage  @param {number} [bytes] */
  const mkBuf = (usage, bytes = N * 4) => gpu.createBuffer({ size: bytes, usage });

  // Core image buffers
  const bPx    = mkBuf(S | D, px.byteLength);
  const bGray  = mkBuf(S | C);
  const bSum   = mkBuf(S);
  const bSumSq = mkBuf(S);
  const bBin   = mkBuf(S | C);

  gpu.queue.writeBuffer(bPx, 0, px);

  // Tile-total side buffers for the chained prefix scan
  // Size: rows × numColTiles (row scan) or cols × numRowTiles (col scan)
  const bRowT   = mkBuf(S, H * numColTiles * 4);   // row tile totals (iSum)
  const bRowTSq = mkBuf(S, H * numColTiles * 4);   // row tile totals (iSumSq)
  const bColT   = mkBuf(S, W * numRowTiles * 4);   // col tile totals (iSum)
  const bColTSq = mkBuf(S, W * numRowTiles * 4);   // col tile totals (iSumSq)

  // Uniform buffers
  const uBase = gpu.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | D });
  gpu.queue.writeBuffer(uBase, 0, new Uint32Array([W, H]));

  const uSauv = gpu.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | D });
  gpu.queue.writeBuffer(uSauv, 0, buildUniformSauvola(W, H, winSize, k, SAUVOLA_R));

  // ── Get or build compiled pipelines (cached) ─────────────────────────
  const pipes = _getPipelines();

  // ── Bind groups ───────────────────────────────────────────────────────
  const bg  = (p, entries) => gpu.createBindGroup({ layout: p.getBindGroupLayout(0), entries });
  const res = b => ({ buffer: b });

  const bgGray     = bg(pipes.pGray, [
    { binding: 0, resource: res(uBase) },
    { binding: 1, resource: res(bPx)   },
    { binding: 2, resource: res(bGray) },
    { binding: 3, resource: res(bSum)  },
    { binding: 4, resource: res(bSumSq)},
  ]);
  const bgRowLocal = bg(pipes.pRowLocal, [
    { binding: 0, resource: res(uBase)  },
    { binding: 1, resource: res(bSum)   },
    { binding: 2, resource: res(bSumSq) },
    { binding: 3, resource: res(bRowT)  },
    { binding: 4, resource: res(bRowTSq)},
  ]);
  const bgRowTiles = bg(pipes.pRowTiles, [
    { binding: 0, resource: res(uBase)  },
    { binding: 1, resource: res(bRowT)  },
    { binding: 2, resource: res(bRowTSq)},
  ]);
  const bgRowApply = bg(pipes.pRowApply, [
    { binding: 0, resource: res(uBase)  },
    { binding: 1, resource: res(bSum)   },
    { binding: 2, resource: res(bSumSq) },
    { binding: 3, resource: res(bRowT)  },
    { binding: 4, resource: res(bRowTSq)},
  ]);
  const bgColLocal = bg(pipes.pColLocal, [
    { binding: 0, resource: res(uBase)  },
    { binding: 1, resource: res(bSum)   },
    { binding: 2, resource: res(bSumSq) },
    { binding: 3, resource: res(bColT)  },
    { binding: 4, resource: res(bColTSq)},
  ]);
  const bgColTiles = bg(pipes.pColTiles, [
    { binding: 0, resource: res(uBase)  },
    { binding: 1, resource: res(bColT)  },
    { binding: 2, resource: res(bColTSq)},
  ]);
  const bgColApply = bg(pipes.pColApply, [
    { binding: 0, resource: res(uBase)  },
    { binding: 1, resource: res(bSum)   },
    { binding: 2, resource: res(bSumSq) },
    { binding: 3, resource: res(bColT)  },
    { binding: 4, resource: res(bColTSq)},
  ]);
  const bgSauv = bg(pipes.pSauv, [
    { binding: 0, resource: res(uSauv) },
    { binding: 1, resource: res(bSum)  },
    { binding: 2, resource: res(bSumSq)},
    { binding: 3, resource: res(bGray) },
    { binding: 4, resource: res(bBin)  },
  ]);

  // ── Record all 8 compute passes in a single encoder ──────────────────
  const t0  = performance.now();
  const enc = gpu.createCommandEncoder({ label: 'sauvola-v2' });

  // Pass 1 — greyscale + SAT seed
  {
    const p = enc.beginComputePass({ label: 'gray' });
    p.setPipeline(pipes.pGray); p.setBindGroup(0, bgGray);
    p.dispatchWorkgroups(Math.ceil(N / 256));
    p.end();
  }

  // Passes 2a-2c — horizontal (row) prefix scan
  {
    // 2a: tile-wise local scan
    const p = enc.beginComputePass({ label: 'row-local' });
    p.setPipeline(pipes.pRowLocal); p.setBindGroup(0, bgRowLocal);
    p.dispatchWorkgroups(H, numColTiles);
    p.end();
  }
  {
    // 2b: scan tile totals per row (few iterations, tiny workload)
    const p = enc.beginComputePass({ label: 'row-tiles' });
    p.setPipeline(pipes.pRowTiles); p.setBindGroup(0, bgRowTiles);
    p.dispatchWorkgroups(H);
    p.end();
  }
  {
    // 2c: apply tile offsets (fully parallel)
    const p = enc.beginComputePass({ label: 'row-apply' });
    p.setPipeline(pipes.pRowApply); p.setBindGroup(0, bgRowApply);
    p.dispatchWorkgroups(H, numColTiles);
    p.end();
  }

  // Passes 3a-3c — vertical (column) prefix scan
  {
    const p = enc.beginComputePass({ label: 'col-local' });
    p.setPipeline(pipes.pColLocal); p.setBindGroup(0, bgColLocal);
    p.dispatchWorkgroups(W, numRowTiles);
    p.end();
  }
  {
    const p = enc.beginComputePass({ label: 'col-tiles' });
    p.setPipeline(pipes.pColTiles); p.setBindGroup(0, bgColTiles);
    p.dispatchWorkgroups(W);
    p.end();
  }
  {
    const p = enc.beginComputePass({ label: 'col-apply' });
    p.setPipeline(pipes.pColApply); p.setBindGroup(0, bgColApply);
    p.dispatchWorkgroups(W, numRowTiles);
    p.end();
  }

  // Pass 4 — Sauvola threshold
  {
    const p = enc.beginComputePass({ label: 'sauvola' });
    p.setPipeline(pipes.pSauv); p.setBindGroup(0, bgSauv);
    p.dispatchWorkgroups(Math.ceil(W / 16), Math.ceil(H / 16));
    p.end();
  }

  // Stage readback buffers
  const rBin  = mkBuf(R);
  const rGray = mkBuf(R);
  enc.copyBufferToBuffer(bBin,  0, rBin,  0, N * 4);
  enc.copyBufferToBuffer(bGray, 0, rGray, 0, N * 4);

  gpu.queue.submit([enc.finish()]);

  // ── Readback ──────────────────────────────────────────────────────────
  await rBin.mapAsync(GPUMapMode.READ);
  const binary = new Uint32Array(rBin.getMappedRange().slice(0));
  rBin.unmap();

  await rGray.mapAsync(GPUMapMode.READ);
  const gray = new Float32Array(rGray.getMappedRange().slice(0));
  rGray.unmap();

  const gpuMs = performance.now() - t0;

  // ── Destroy all per-run buffers ───────────────────────────────────────
  for (const b of [bPx,bGray,bSum,bSumSq,bBin,
                   bRowT,bRowTSq,bColT,bColTSq,
                   uBase,uSauv,rBin,rGray]) {
    b.destroy();
  }

  return { binary, gray, gpuMs };
}

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

/**
 * Get (or lazily build) the pipeline cache for the current GPU device.
 *
 * Compilation happens once per device lifetime.  If the GPU device is lost
 * and `initGPU()` is called again, a new device object is created and the
 * WeakMap misses, causing pipelines to be recompiled for the new device.
 *
 * @returns {Object} Map of pipeline name → GPUComputePipeline.
 */
function _getPipelines() {
  if (pipelineCache.has(gpu)) return pipelineCache.get(gpu);

  /**
   * @param {string} src
   * @returns {GPUComputePipeline}
   */
  const compile = src => gpu.createComputePipeline({
    layout : 'auto',
    compute: { module: gpu.createShaderModule({ code: src }), entryPoint: 'main' },
  });

  const pipes = {
    pGray    : compile(SH_GRAY),
    pRowLocal: compile(SH_ROW_LOCAL),
    pRowTiles: compile(SH_ROW_TILES),
    pRowApply: compile(SH_ROW_APPLY),
    pColLocal: compile(SH_COL_LOCAL),
    pColTiles: compile(SH_COL_TILES),
    pColApply: compile(SH_COL_APPLY),
    pSauv    : compile(SH_SAUVOLA),
  };

  pipelineCache.set(gpu, pipes);
  return pipes;
}

/**
 * Pack an ImageData byte array into Uint32 packed pixels (R|G<<8|B<<16|255<<24).
 * @param {ImageData} imgData
 * @returns {Uint32Array}
 */
function packPixels(imgData) {
  const N  = imgData.width * imgData.height;
  const d  = imgData.data;
  const px = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    px[i] = d[i*4] | (d[i*4+1] << 8) | (d[i*4+2] << 16) | (255 << 24);
  }
  return px;
}

/**
 * Build the 24-byte uniform struct for the Sauvola pass.
 * Fields: width(u32), height(u32), halfW(i32), k(f32), R(f32), _pad(u32).
 * @param {number} W @param {number} H @param {number} winSize
 * @param {number} k @param {number} R
 * @returns {ArrayBuffer}
 */
function buildUniformSauvola(W, H, winSize, k, R) {
  const ab = new ArrayBuffer(24);
  const dv = new DataView(ab);
  dv.setUint32 (0,  W,                       true);
  dv.setUint32 (4,  H,                       true);
  dv.setInt32  (8,  Math.floor(winSize / 2), true);
  dv.setFloat32(12, k,                       true);
  dv.setFloat32(16, R,                       true);
  dv.setUint32 (20, 0,                       true);
  return ab;
}
