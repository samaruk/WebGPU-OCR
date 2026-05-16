/**
 * gpu/pipeline.js — runGPU (existing) + gpuComputeOBB (new).
 *
 * gpuComputeOBB replaces the two O(N) CPU passes that were in cpu/process.js:
 *
 *   OLD cpu/process.js:
 *     Pass 1 O(N): accumulate covariance → PCA eigenvectors
 *     Pass 2 O(N): project dilated pixels onto PCA axes → min/max extents
 *
 *   NEW gpu/pipeline.js (gpuComputeOBB):
 *     CPU O(K): compute centroids from 1st-order stats (trivial, already done)
 *     CPU O(Nskel): BFS per component → skeleton-direction axis (Nskel << N)
 *     GPU O(N): PROJ_ACCUM — parallel projection scatter (atomicMin/atomicMax)
 *     GPU O(K): OBB_BUILD — finalise OBB parameters from accumulated extents
 *     Readback: K × 6 floats (a few hundred bytes, negligible)
 *
 * TOTAL WORK REDUCTION:
 *   Before: 2 × O(N) × 8–10 ops/pixel on a single CPU thread ≈ 10–20 ms
 *   After:  1 × O(N) GPU dispatch (parallel) + small CPU skeleton work ≈ 1–3 ms
 */

import { gDev, gBGLs, gPipes }                      from './device.js';
import { mkStorBuf, uU32, uMixed, uniTemps }          from './helpers.js';
import { dispatch, dispatch1D, copyBuf, readbackU32, computeSAT } from './dispatch.js';
import { compactLabels }                              from '../cpu/labels.js';
import { CS_BITS, PROJ_SCALE }                        from '../config.js';

// ── runGPU ────────────────────────────────────────────────────────────────────

/**
 * runGPU — Execute the binarization → dilation → thinning → CCA → stats GPU pipeline.
 * Returns raw typed arrays for the CPU phases (axis derivation, polyline extraction).
 *
 * This function is unchanged from the previous version except it no longer needs to
 * return or receive OBB data — that is handled by gpuComputeOBB below.
 */
export async function runGPU(imageData, cfg) {
  const W = imageData.width, H = imageData.height, N = W * H;
  const F4 = N * 4, U4 = N * 4;

  const packed = new Uint32Array(N);
  const raw = imageData.data;
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    packed[i] = raw[j] | (raw[j+1] << 8) | (raw[j+2] << 16) | (raw[j+3] << 24);
  }

  const rgbaBuf   = gDev.createBuffer({ size:U4, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST });
  const grayBuf   = mkStorBuf(F4), grayqBuf = mkStorBuf(F4);
  const satG1     = mkStorBuf(F4), satG2    = mkStorBuf(F4);
  const satQ1     = mkStorBuf(F4), satQ2    = mkStorBuf(F4);
  const binBuf    = mkStorBuf(U4);
  const dilA      = mkStorBuf(U4), dilB  = mkStorBuf(U4);
  const sklA      = mkStorBuf(U4), sklB  = mkStorBuf(U4);
  const parentBuf = mkStorBuf(U4);
  gDev.queue.writeBuffer(rgbaBuf, 0, packed);

  const t0 = performance.now();

  dispatch(gPipes.gray,    gBGLs.gray,    [rgbaBuf, grayBuf, grayqBuf, uU32(W,H)], W, H);
  const sat1 = computeSAT(grayBuf,  satG1, satG2, W, H);
  const sat2 = computeSAT(grayqBuf, satQ1, satQ2, W, H);
  dispatch(gPipes.sauvola, gBGLs.sauvola, [sat1, sat2, grayBuf, binBuf,
    uMixed([{t:'u32',v:W},{t:'u32',v:H},{t:'u32',v:cfg.radius},{t:'u32',v:0},{t:'f32',v:cfg.k},{t:'f32',v:0.5}])
  ], W, H);
  dispatch(gPipes.dilate, gBGLs.dilate, [binBuf, dilA, uU32(W,H,cfg.dilW,0)], W, H);
  dispatch(gPipes.dilate, gBGLs.dilate, [dilA,   dilB, uU32(W,H,cfg.dilH,1)], W, H);
  copyBuf(dilB, sklA, U4);
  const uZS0 = uU32(W,H,0,0), uZS1 = uU32(W,H,1,0);
  for (let i = 0; i < cfg.zsIters; i++) {
    dispatch(gPipes.zs, gBGLs.zs, [sklA, sklB, uZS0], W, H);
    dispatch(gPipes.zs, gBGLs.zs, [sklB, sklA, uZS1], W, H);
  }
  const uWH = uU32(W, H);
  dispatch(gPipes.ccaInit, gBGLs.ccaInit, [parentBuf, dilB, uWH], W, H);
  for (let i = 0; i < cfg.ccaIters; i++) {
    dispatch(gPipes.ccaMerge,    gBGLs.ccaOp, [parentBuf, uWH], W, H);
    dispatch(gPipes.ccaCompress, gBGLs.ccaOp, [parentBuf, uWH], W, H);
  }

  await gDev.queue.onSubmittedWorkDone();
  const [binary, dilated, skeleton, parentArr] = await Promise.all([
    readbackU32(binBuf,    N),
    readbackU32(dilB,      N),
    readbackU32(sklA,      N),
    readbackU32(parentBuf, N),
  ]);

  const { labelArr, K } = compactLabels(parentArr, N);

  const labelBuf = mkStorBuf(Math.max(16, U4));
  gDev.queue.writeBuffer(labelBuf, 0, labelArr);
  const NS = 3;
  const statsBuf = gDev.createBuffer({ size:Math.max(16,K*NS*4), usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC });
  if (K > 0) {
    dispatch1D(gPipes.statsClear, gBGLs.statsClear, [statsBuf, uU32(K*NS)], K*NS);
    dispatch(  gPipes.statsAccum, gBGLs.statsAccum, [labelBuf, statsBuf, uU32(W,H,K,CS_BITS)], W, H);
  }

  const tGPU = Math.round(performance.now() - t0);
  await gDev.queue.onSubmittedWorkDone();
  const statsArr = K > 0 ? await readbackU32(statsBuf, K*NS) : new Uint32Array(0);

  [grayBuf,grayqBuf,satG1,satG2,satQ1,satQ2,binBuf,dilA,dilB,
   sklA,sklB,parentBuf,labelBuf,statsBuf].forEach(b => b.destroy());
  uniTemps.splice(0).forEach(b => b.destroy());

  return { binary, dilated, skeleton, labelArr, K, statsArr, W, H, tGPU, rgbaBuf };
}

// ── gpuComputeOBB — NEW ───────────────────────────────────────────────────────

/**
 * gpuComputeOBB — GPU-parallel projection + OBB finalization.
 *
 * Replaces the two O(N) CPU passes from the old cpu/process.js:
 *   • Old Pass 1 (covariance → PCA): replaced by caller-provided skeleton axis vectors.
 *   • Old Pass 2 (projection extents): replaced by SHADER_PROJ_ACCUM (GPU, parallel).
 *
 * WHY THE AXIS COMES FROM THE CPU CALLER (not computed inside this function):
 *   The axis direction comes from skeleton BFS endpoints (see cpu/process.js:runCPU_axes).
 *   That BFS is already needed for polyline extraction. Reusing the same endpoints for the
 *   OBB axis avoids a completely separate O(N²) covariance accumulation stage — and the
 *   skeleton direction is actually more stable for text lines than eigendecomposition of
 *   an irregular blob (whose shape may be heavily influenced by serif serrations).
 *
 * @param {number}       W, H      processed image dimensions
 * @param {Uint32Array}  labelArr  compact label per pixel [0,K) or 0xFFFFFFFF
 * @param {number}       K         number of CCA components
 * @param {Float32Array} centX, centY  approximate component centroids (from statsArr)
 * @param {Float32Array} axVX, axVY   skeleton-derived primary axis per component
 * @returns {Promise<Float32Array>}   K × 6 floats: [cx, cy, vx, vy, hw, hh] per component
 */
export async function gpuComputeOBB(W, H, labelArr, K, centX, centY, axVX, axVY) {
  if (K === 0) return new Float32Array(0);

  // ── Upload per-component centroid and axis data ───────────────────────────
  const centData = new Float32Array(K * 2);
  const axisData = new Float32Array(K * 2);
  for (let k = 0; k < K; k++) {
    centData[k*2]   = centX[k]; centData[k*2+1] = centY[k];
    axisData[k*2]   = axVX[k];  axisData[k*2+1] = axVY[k];
  }

  // WHY STORAGE|COPY_DST for cent/axis: written from CPU via queue.writeBuffer.
  // WHY no COPY_SRC: we never read them back — only shaders consume them.
  const centBuf  = gDev.createBuffer({ size:Math.max(16,K*2*4), usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST });
  const axisBuf  = gDev.createBuffer({ size:Math.max(16,K*2*4), usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST });
  gDev.queue.writeBuffer(centBuf, 0, centData);
  gDev.queue.writeBuffer(axisBuf, 0, axisData);

  // labelArr: W×H uint32 — same buffer format as stats stage.
  const labelBuf = gDev.createBuffer({ size:Math.max(16,W*H*4), usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST });
  gDev.queue.writeBuffer(labelBuf, 0, labelArr);

  // projBuf: K×4 i32 — one (minU, maxU, minV, maxV) tuple per component.
  // WHY STORAGE only (no COPY_SRC): intermediate buffer, never read by CPU.
  const projBuf = gDev.createBuffer({ size:Math.max(16,K*4*4), usage:GPUBufferUsage.STORAGE });

  // obbBuf: K×6 f32 — final OBB parameters, read back to CPU.
  const obbBuf  = gDev.createBuffer({ size:Math.max(16,K*6*4), usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC });

  // ── Stage 1: initialise projection sentinels ─────────────────────────────
  // minU/minV slots → INT_MAX; maxU/maxV slots → INT_MIN (see SHADER_PROJ_CLEAR).
  dispatch1D(gPipes.projClear, gBGLs.projClear, [projBuf, uU32(K*4)], K*4);

  // ── Stage 2: scatter pixel projections (the O(N) GPU pass) ───────────────
  // Each thread reads its label, looks up centroid + axis, projects, and calls
  // atomicMin/atomicMax. All pixels run simultaneously — O(N) wall-clock time.
  dispatch(gPipes.projAccum, gBGLs.projAccum,
    [labelBuf, centBuf, axisBuf, projBuf, uU32(W, H, K, PROJ_SCALE)], W, H);

  // ── Stage 3: finalise OBB parameters (O(K) GPU pass) ─────────────────────
  dispatch1D(gPipes.obbBuild, gBGLs.obbBuild,
    [centBuf, axisBuf, projBuf, obbBuf, uU32(K, PROJ_SCALE)], K);

  await gDev.queue.onSubmittedWorkDone();

  // Readback: K×6 floats ≈ 240 bytes for 10 components — negligible transfer cost.
  const rawU32 = await readbackU32(obbBuf, K * 6);
  const obbF32 = new Float32Array(rawU32.buffer); // reinterpret u32 bits as f32

  [centBuf, axisBuf, labelBuf, projBuf, obbBuf].forEach(b => b.destroy());
  uniTemps.splice(0).forEach(b => b.destroy());

  return obbF32;
}
