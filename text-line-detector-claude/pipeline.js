/**
 * pipeline.js — Main processing pipeline orchestrator.
 *
 * WHY THIS FILE EXISTS:
 *   The full pipeline has 13 GPU shaders, 4 CPU algorithms, and many readback
 *   steps. This file is the single entry point that sequences all of them in
 *   the correct order, passes data between GPU and CPU stages, and feeds
 *   results to the display functions.
 *
 * PIPELINE OVERVIEW (in order):
 *   GPU Phase 1 — Preprocessing + Binarisation
 *     gray → blur (H+V) → SAT (row+col) → Sauvola binary
 *   CPU Phase 2 — Skew Detection (reads back binary)
 *     detectSkew → angle
 *   GPU Phase 3 — Skew Correction (only if |angle| > threshold)
 *     rotate blurred gray → re-run SAT → re-binarise (rotated binary)
 *   GPU Phase 4 — Distance Transform (JFA, for visualisation)
 *     init seeds → log2(maxDim) JFA steps → extract distances
 *   GPU Phase 5 — Morphology + Skeleton
 *     dilate H → dilate V → ZS thinning (ping-pong N iterations)
 *   CPU Phase 6 — Readback
 *     binary, dilated, skeleton, distance → Float32Arrays on CPU
 *   CPU Phase 7 — CCA on dilated binary
 *     union-find → line component bounds + per-pixel label map
 *   CPU Phase 8 — Per-component skeleton graph + OBB
 *     for each CCA line: build local graph → prune → longest path →
 *     RDP → Catmull-Rom → buildMinRect → polygon
 *   CPU Phase 9 — Rotate polygons back (if skew was corrected)
 *   Display — update all stage canvases and result canvas
 *
 * WHY SEPARATE GPU SUBMITS FOR PHASES 1, 3, 4, 5:
 *   Phase 2 (skew detection) must run on CPU AFTER reading back the binary.
 *   This requires a GPU submit + await between Phase 1 and Phase 3.
 *   Similarly, the JFA distance transform (Phase 4) must complete before
 *   the DIST shader can extract final values. Batching Phases 4 and 5
 *   into one submit avoids an extra await.
 *
 * BUFFER LIFECYCLE:
 *   All GPU buffers are created at the start of run() and destroyed at the end.
 *   This avoids memory leaks from accumulation across multiple run() calls.
 */

import {
  SH_GRAY, SH_BLH, SH_BLV,
  SH_SAT_ROW, SH_SAT_COL, SH_SAUVOLA,
  SH_ROTATE,
  SH_DILH, SH_DILV, SH_ZS,
  SH_JFA_INIT, SH_JFA_STEP, SH_DIST
} from './shaders.js';

import { detectSkew, detectSkewFromBlobs }           from './skew.js';
import { cca }                                       from './cca.js';
import { buildLocalGraph, pruneGraph,
         graphComponents, longestPath }              from './graph.js';
import { rdp, catmullRom, buildMinRect,
         rotatePolyBack }                            from './geometry.js';
import { showGray, showBinary, showDist,
         showPolyDebug, showResult, showCCA }          from './display.js';

/**
 * Run the full text-line detection pipeline.
 *
 * @param {Uint32Array} imgRGBA - Packed RGBA image pixels
 * @param {number}      imgW, imgH - Image dimensions
 * @param {GPU}         gpu     - Initialised GPU wrapper instance
 * @param {object}      params  - Runtime parameters (from CONFIG + UI sliders)
 * @param {object}      canvases - Map of canvas elements by stage name
 * @param {function}    log     - Logging callback(message, cssClass)
 * @returns {Promise<Array<Array<{x,y}>>>} Final polygon array
 */
export async function run(imgRGBA, imgW, imgH, gpu, params, canvases, log) {
  const W = imgW, H = imgH, N = W * H;
  const d = gpu.dev;
  const t0 = performance.now();

  // ── Compile pipelines (cached after first call) ───────────────────────────
  log('Compiling shaders...', 'hi');
  const pGray    = gpu.pl(SH_GRAY);
  const pBlH     = gpu.pl(SH_BLH);
  const pBlV     = gpu.pl(SH_BLV);
  const pSatRow  = gpu.pl(SH_SAT_ROW);
  const pSatCol  = gpu.pl(SH_SAT_COL);
  const pSauv    = gpu.pl(SH_SAUVOLA);
  const pRot     = gpu.pl(SH_ROTATE);
  const pDilH    = gpu.pl(SH_DILH);
  const pDilV    = gpu.pl(SH_DILV);
  const pZS      = gpu.pl(SH_ZS);
  const pJfaInit = gpu.pl(SH_JFA_INIT);
  const pJfaStep = gpu.pl(SH_JFA_STEP);
  const pDist    = gpu.pl(SH_DIST);

  // ── Allocate GPU buffers ──────────────────────────────────────────────────
  log('Allocating buffers...', 'hi');
  const bRGBA    = gpu.u32buf(imgRGBA);
  const bGray    = gpu.fbuf(N);
  const bBlurH   = gpu.fbuf(N);
  const bBlur    = gpu.fbuf(N);
  const bSatS    = gpu.fbuf(N);
  const bSatSq   = gpu.fbuf(N);
  const bBin     = gpu.fbuf(N);  // binarised in original orientation
  const bBinRot  = gpu.fbuf(N);  // binarised after skew correction
  const bJfaXA   = gpu.fbuf(N); const bJfaYA = gpu.fbuf(N);
  const bJfaXB   = gpu.fbuf(N); const bJfaYB = gpu.fbuf(N);
  const bDist    = gpu.fbuf(N);
  const bDilH    = gpu.fbuf(N);
  const bDil     = gpu.fbuf(N);
  const bSkelA   = gpu.fbuf(N);
  const bSkelB   = gpu.fbuf(N);

  // ── Uniforms ──────────────────────────────────────────────────────────────
  const sauvK  = params.invertBinary ? -params.sauvolaK : params.sauvolaK;
  const uBase  = gpu.uni(W, H);
  const uSauv  = gpu.uni(W, H, params.sauvolaRadius, sauvK);
  // Pre-rotation uniforms (small radii — skew-detection blob building only)
  const uPreDilH = gpu.uni(W, H, params.preDilationH, 0);
  const uPreDilV = gpu.uni(W, H, params.preDilationV, 0);
  // Post-rotation uniforms (larger radii — CCA + skeleton line detection)
  const uDilH  = gpu.uni(W, H, params.dilationH, 0);
  const uDilV  = gpu.uni(W, H, params.dilationV, 0);
  const uZS1   = gpu.uni(W, H, 0, 0);  // sub-iteration 1
  const uZS2   = gpu.uni(W, H, 1, 0);  // sub-iteration 2

  // ══════════════════════════════════════════════════════════════════════════
  //  GPU Phase 1: gray → blur → SAT → Sauvola binary
  // ══════════════════════════════════════════════════════════════════════════
  log('GPU: gray → blur → SAT → Sauvola...', 'hi');
  {
    const enc = d.createCommandEncoder();
    gpu.dispatch(enc, pGray,   [bRGBA,  bGray,  uBase],           W, H);
    gpu.dispatch(enc, pBlH,    [bGray,  bBlurH, uBase],           W, H);
    gpu.dispatch(enc, pBlV,    [bBlurH, bBlur,  uBase],           W, H);
    // SAT: row scan uses 1D dispatch (one thread per row)
    gpu.dispatch1D(enc, pSatRow, [bBlur, bSatS, bSatSq, uBase],  H);
    // SAT: column scan uses 1D dispatch (one thread per column)
    gpu.dispatch1D(enc, pSatCol, [bSatS, bSatSq, uBase],         W);
    gpu.dispatch(enc, pSauv,  [bBlur, bSatS, bSatSq, bBin, uSauv], W, H);
    d.queue.submit([enc.finish()]);
  }
  await d.queue.onSubmittedWorkDone();
  log(`Binarize: ${(performance.now() - t0).toFixed(0)} ms`, 'ok');

  // Read back blur for display + binary for skew detection
  const dataBlur = await gpu.readback(bBlur, N);
  showGray(canvases.gray, dataBlur, W, H);
  if (canvases.infoGray) canvases.infoGray.textContent = `${W}x${H}`;

  const dataBin0 = await gpu.readback(bBin, N);
  showBinary(canvases.bin, dataBin0, W, H, [245, 158, 11]);
  const textFrac = dataBin0.reduce((s, v) => s + (v > 0.5 ? 1 : 0), 0) / N;
  if (canvases.infoBin) canvases.infoBin.textContent = `${(textFrac * 100).toFixed(1)}% text`;

  // Phase 2.5: pre-dilate original binary so blobs are ready for skew detection.
  // WHY DETECT SKEW FROM DILATED BLOBS:
  //   Each dilated blob is one thick, solid rectangle aligned with a text line.
  //   PCA of blob pixel coordinates gives exact orientation.
  //   Projection-profile on grayscale can return 0 when text is sparse or the
  //   image has complex layout. Blobs are never ambiguous.
  {
    const enc = d.createCommandEncoder();
    // WHY uPreDilH/V (small): keeps blobs narrow and line-separated for PCA.
    // Large uDilH/V would merge adjacent lines → wrong skew angle.
    gpu.dispatch(enc, pDilH, [bBin, bDilH, uPreDilH], W, H);
    gpu.dispatch(enc, pDilV, [bDilH, bDil,  uPreDilV], W, H);
    d.queue.submit([enc.finish()]);
  }
  await d.queue.onSubmittedWorkDone();
  const dataDilPre = await gpu.readback(bDil, N);

  log('Detecting skew from dilated blobs...', 'hi');
  const t1 = performance.now();
  const skewAngle = detectSkewFromBlobs(dataDilPre, W, H, params.preDilationH, params.preDilationV, dataBin0);
  // Pass preDilationH/V (not dilationH/V): the B-correction formula inside
  // detectSkewFromBlobs must match the radii used to build dataDilPre.
  log(`Skew: ${skewAngle > 0 ? '+' : ''}${skewAngle.toFixed(1)}deg in ${(performance.now()-t1).toFixed(0)} ms`, 'ok');

  // ══════════════════════════════════════════════════════════════════════════
  //  GPU Phase 3: Skew correction (only when |angle| > threshold)
  // ══════════════════════════════════════════════════════════════════════════
  let bBinFinal = bBin;
  const needsRotation = Math.abs(skewAngle) > params.skewThreshDeg;

  if (needsRotation) {
    log(`Rotating ${skewAngle.toFixed(1)}deg...`, 'hi');
    // WHY NEGATE: skewAngle is the detected blob angle (+30° for a 30° CW image).
    // The shader's forward mapping rotates content by +rad.
    // To straighten +30° content back to 0°, we need rad = −30° = −skewAngle.
    // Using +skewAngle would rotate +30° → +60°, doubling the error.
    const rad = -skewAngle * Math.PI / 180;
    const uRot = gpu.uni(W, H, Math.cos(rad), Math.sin(rad));
    const enc = d.createCommandEncoder();
    // Rotate the blurred gray image (not the binary — bilinear on binary creates
    // half-values at edges that confuse Sauvola)
    gpu.dispatch(enc, pRot,    [bBlur, bGray,  uRot],              W, H);
    gpu.dispatch1D(enc, pSatRow, [bGray, bSatS, bSatSq, uBase],    H);
    gpu.dispatch1D(enc, pSatCol, [bSatS, bSatSq, uBase],           W);
    gpu.dispatch(enc, pSauv,   [bGray, bSatS, bSatSq, bBinRot, uSauv], W, H);
    // Re-dilate the rotated binary — Phase 2.5's bDil was for the un-rotated
    // binary and is now stale. bDil must reflect the corrected orientation.
    gpu.dispatch(enc, pDilH, [bBinRot, bDilH, uDilH], W, H);
    gpu.dispatch(enc, pDilV, [bDilH,   bDil,  uDilV], W, H);
    d.queue.submit([enc.finish()]);
    await d.queue.onSubmittedWorkDone();
    bBinFinal = bBinRot;
    uRot.destroy();

    const dataBinRot = await gpu.readback(bBinRot, N);
    showBinary(canvases.rot, dataBinRot, W, H, [56, 189, 248]);
    if (canvases.infoRot) canvases.infoRot.textContent = `${skewAngle.toFixed(1)}deg corrected`;
  } else {
    showBinary(canvases.rot, dataBin0, W, H, [80, 80, 80]);
    if (canvases.infoRot) canvases.infoRot.textContent = 'no correction needed';

    // WHY RE-DILATE EVEN WHEN NO ROTATION IS APPLIED:
    //   Phase 2.5 used preDilationH/V (small) for skew detection.
    //   CCA and skeleton need dilationH/V (larger) to bridge word gaps.
    //   Must always overwrite bDil with post-rotation params.
    {
      const enc = d.createCommandEncoder();
      gpu.dispatch(enc, pDilH, [bBin, bDilH, uDilH], W, H);
      gpu.dispatch(enc, pDilV, [bDilH, bDil,  uDilV], W, H);
      d.queue.submit([enc.finish()]);
    }
    await d.queue.onSubmittedWorkDone();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GPU Phase 4: JFA distance transform (for visualisation)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const enc = d.createCommandEncoder();
    gpu.dispatch(enc, pJfaInit, [bBinFinal, bJfaXA, bJfaYA, uBase], W, H);
    d.queue.submit([enc.finish()]);
  }
  {
    // All JFA steps in one compute pass — single GPU submit, no round-trips.
    const maxDim = Math.max(W, H);
    let step = 1; while (step * 2 < maxDim) step *= 2;

    const enc = d.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pJfaStep);
    let srcX = bJfaXA, srcY = bJfaYA, dstX = bJfaXB, dstY = bJfaYB;

    while (step >= 1) {
      const uJFA = gpu.uni(W, H, step, 0);
      const bg = d.createBindGroup({
        layout: pJfaStep.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: srcX } },
          { binding: 1, resource: { buffer: srcY } },
          { binding: 2, resource: { buffer: dstX } },
          { binding: 3, resource: { buffer: dstY } },
          { binding: 4, resource: { buffer: uJFA } }
        ]
      });
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(Math.ceil(W / 16), Math.ceil(H / 16));
      [srcX, dstX] = [dstX, srcX];
      [srcY, dstY] = [dstY, srcY];
      step >>= 1;
    }
    pass.end();

    // Extract final distances in the same command buffer
    const bgDist = d.createBindGroup({
      layout: pDist.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcX } },
        { binding: 1, resource: { buffer: srcY } },
        { binding: 2, resource: { buffer: bDist } },
        { binding: 3, resource: { buffer: uBase } }
      ]
    });
    const dp = enc.beginComputePass();
    dp.setPipeline(pDist); dp.setBindGroup(0, bgDist);
    dp.dispatchWorkgroups(Math.ceil(W / 16), Math.ceil(H / 16));
    dp.end();

    // ════════════════════════════════════════════════════════════════════════
    //  GPU Phase 5: Morphological dilation + Zhang-Suen skeleton
    // ════════════════════════════════════════════════════════════════════════
    // Appended to the same encoder to avoid an extra submit/await.
    // bDil always holds the POST-ROTATION dilation at this point:
    //   rotation path    → Phase 3 re-dilated bBinRot with dilH/V
    //   no-rotation path → else-branch re-dilated bBin with dilH/V
    // Both paths use the larger post-rotation radii. Seed skeleton from bDil.
    enc.copyBufferToBuffer(bDil, 0, bSkelA, 0, N * 4);

    // ZS thinning: N full iterations, each = sub1 (A→B) + sub2 (B→A).
    // All dispatched in one encoder → single GPU submit → no CPU round-trips.
    for (let i = 0; i < params.zsIterations; i++) {
      gpu.dispatch(enc, pZS, [bSkelA, bSkelB, uZS1], W, H); // sub-iter 1
      gpu.dispatch(enc, pZS, [bSkelB, bSkelA, uZS2], W, H); // sub-iter 2
    }

    d.queue.submit([enc.finish()]);
  }
  await d.queue.onSubmittedWorkDone();
  log(`Dilate + ZS(${params.zsIterations} iters): ${(performance.now()-t0).toFixed(0)} ms`, 'ok');

  // ══════════════════════════════════════════════════════════════════════════
  //  CPU Phase 6: Readback all results
  // ══════════════════════════════════════════════════════════════════════════
  const [dataBinFinal, dataDil, dataSkel, dataDist] = await Promise.all([
    gpu.readback(bBinFinal, N),
    gpu.readback(bDil,      N),
    gpu.readback(bSkelA,    N),
    gpu.readback(bDist,     N)
  ]);
  const t2 = performance.now();
  log(`Readback: ${(t2 - t0).toFixed(0)} ms`, 'ok');

  // Display intermediate GPU results
  const skelPx = dataSkel.reduce((s, v) => s + (v > 0.5 ? 1 : 0), 0);
  showBinary(canvases.dil,  dataDil,  W, H, [56, 189, 248]);
  showBinary(canvases.skel, dataSkel, W, H, [248, 113, 113]);
  showDist(canvases.dist,   dataDist, W, H);
  if (canvases.infoDil)  canvases.infoDil.textContent  = `H=${params.dilationH} V=${params.dilationV}`;
  if (canvases.infoSkel) canvases.infoSkel.textContent = `${skelPx.toLocaleString()} px`;
  if (canvases.infoDist) canvases.infoDist.textContent = 'JFA DT (display only)';

  // ══════════════════════════════════════════════════════════════════════════
  //  CPU Phase 7: CCA on dilated binary
  // ══════════════════════════════════════════════════════════════════════════
  const minLineW = Math.floor(W * params.minLineWidthPct);
  const { components: allDilComps, labelMap: dilLabelMap } = cca(dataDil, W, H);
  const lineComps = allDilComps.filter(c => {
    const w = c.maxX - c.minX, h = c.maxY - c.minY;
    const longer = Math.max(w, h), shorter = Math.min(w, h);
    // WHY ELONGATION CHECK (longer > shorter*1.5):
    // Text line blobs are elongated in the direction of the text.
    // After rotation correction, this is the horizontal direction.
    // Square or tall blobs are punctuation marks, noise, or small isolated words.
    return c.area >= Math.max(80, minLineW) && longer >= minLineW && longer > shorter * 1.2;
  });
  log(`CCA: ${lineComps.length} line candidates`, 'hi');

  // WHY SHOW allDilComps (all components, not just lineComps):
  //   Displaying every blob — including small noise, punctuation, table cells
  //   that didn't pass the elongation filter — lets you see the full CCA output
  //   and diagnose whether the dilation merged lines that should be separate
  //   (same colour) or fragmented a line into multiple blobs (one line, two colours).
  if (canvases.cca) {
    showCCA(canvases.cca, dilLabelMap, allDilComps, W, H);
    if (canvases.infoCCA) canvases.infoCCA.textContent =
      `${allDilComps.length} blobs · ${lineComps.length} lines`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CPU Phase 8: Per-CCA-component local graph + OBB building
  // ══════════════════════════════════════════════════════════════════════════
  // WHY LOOP OVER lineComps (not skeleton components):
  //   Skeleton-driven loop can merge two adjacent lines if their ZS skeletons
  //   share an 8-neighbour edge at the blob boundary. Label-filtered local graphs
  //   make it structurally impossible for a graph to span two CCA components.
  const polygons = [];

  for (const lineComp of lineComps) {
    const { minX, maxX, minY, maxY, label } = lineComp;
    const x0 = Math.max(0, minX - 1), x1 = Math.min(W-1, maxX + 1);
    const y0 = Math.max(0, minY - 1), y1 = Math.min(H-1, maxY + 1);

    // Build a local skeleton graph, filtered to this CCA component's label
    const localGraph = buildLocalGraph(dataSkel, dilLabelMap, label, x0, y0, x1, y1, W, H);
    if (localGraph.size < 4) continue;

    // Remove short spike branches before diameter BFS
    pruneGraph(localGraph, W, params.minBranchPx);
    if (localGraph.size < 4) continue;

    // Find connected pieces (pruning may disconnect the graph)
    // Take the piece with the longest diameter (main text axis)
    const pieces = graphComponents(localGraph);
    let bestPath = [], bestLen = 0;
    for (const piece of pieces) {
      if (piece.size < 4) continue;
      const path = longestPath(localGraph, piece, W);
      if (path.length > bestLen) { bestLen = path.length; bestPath = path; }
    }
    if (bestPath.length < 3) continue;

    // Simplify and smooth the centreline
    const simplified = rdp(bestPath, params.rdpEpsilon);
    if (simplified.length < 2) continue;
    const smoothed = catmullRom(simplified, params.catmullSamples);

    // Build the minimum oriented bounding rectangle from actual ink pixels
    const poly = buildMinRect(smoothed, dataBinFinal, W, H, lineComp, params.heightScale);
    if (poly.length >= 4) polygons.push(poly);
  }

  const t3 = performance.now();
  log(`OBB CPU: ${(t3 - t2).toFixed(0)} ms → ${polygons.length} text lines`, 'ok');

  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  //  Phase 9: Display on the CORRECTED (deskewed) image
  // ══════════════════════════════════════════════════════════════════════════
  //
  // WHY NO rotatePolyBack:
  //   OBBs are computed in the corrected image space (text horizontal).
  //   Showing polygons + background both in corrected space means the
  //   rectangles are axis-aligned and easy to inspect. Rotating back to
  //   the original skewed space would tilt every rectangle unnecessarily.
  //
  // HOW THE CORRECTED IMAGE IS PRODUCED FOR DISPLAY:
  //   Canvas 2D rotation of imgRGBA by -skewAngle (same as the GPU shader)
  //   is applied inside showPolyDebug / showResult via corrAngleDeg.
  //   No extra GPU buffer or readback needed.
  //
  // WHEN NO ROTATION WAS APPLIED:
  //   corrAngleDeg = 0 → images are rendered without any Canvas rotation.

  const finalPolys   = polygons;                           // stay in corrected space
  const corrAngleDeg = needsRotation ? skewAngle : 0;     // angle the GPU corrected

  showPolyDebug(canvases.poly,  finalPolys, W, H, imgRGBA, corrAngleDeg);
  showResult(canvases.result,   imgRGBA,    W, H, finalPolys, corrAngleDeg);
  if (canvases.infoPoly)   canvases.infoPoly.textContent   = `${finalPolys.length} polygons`;
  if (canvases.infoResult) canvases.infoResult.textContent =
    `${finalPolys.length} lines · ${(performance.now() - t0).toFixed(0)} ms`;

  log(`DONE — ${finalPolys.length} text-line OBBs · ${(performance.now() - t0).toFixed(0)} ms total`, 'ok');

  // ── Destroy all GPU buffers ───────────────────────────────────────────────
  // WHY EXPLICIT DESTROY: WebGPU buffers are not garbage-collected promptly.
  // Without explicit destroy, repeated run() calls accumulate ~200 MB of
  // unreleased VRAM buffers, causing OOM on integrated graphics.
  [bRGBA, bGray, bBlurH, bBlur, bSatS, bSatSq, bBin, bBinRot,
   bJfaXA, bJfaYA, bJfaXB, bJfaYB, bDist, bDilH, bDil, bSkelA, bSkelB,
   uBase, uSauv, uPreDilH, uPreDilV, uDilH, uDilV, uZS1, uZS2
  ].forEach(b => b.destroy());

  return finalPolys;
}
