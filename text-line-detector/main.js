/**
 * main.js — Application entry point and pipeline orchestration.
 *
 * UPDATED PIPELINE SEQUENCE (4 phases, replacing old 2-phase runGPU + runCPU):
 *
 *   Phase 1 — GPU  : runGPU
 *     gray → SAT → Sauvola → dilate → ZS → CCA∥ → stats∥
 *     Returns: binary, dilated, skeleton, labelArr, statsArr, K, rgbaBuf
 *
 *   Phase 2 — CPU  : runCPU_axes
 *     Centroids from statsArr (O(K)), skeleton grouping (O(N) scan),
 *     double-BFS per component for endpoint axis (O(Nskel))
 *     Returns: centX, centY, axVX, axVY, skelByComp
 *
 *   Phase 3 — GPU  : gpuComputeOBB  ← NEW (replaces 2× O(N) CPU passes)
 *     PROJ_CLEAR + PROJ_ACCUM (O(N) parallel) + OBB_BUILD (O(K) parallel)
 *     Returns: obbF32 — K×6 floats [cx, cy, vx, vy, hw, hh]
 *
 *   Phase 4 — CPU  : runCPU_lines
 *     Build line objects from obbF32 + polylines (O(K) + O(Nskel))
 *
 *   Phase 5 — GPU  : gpuRenderOBB (unchanged)
 *     Parallel OBB fill + stroke (O(N) parallel)
 *
 * NET CHANGE:
 *   Eliminated: 2 × O(N) serial CPU passes (covariance + projection extents)
 *   Added:      1 × O(N) parallel GPU pass (projection scatter)
 *   CPU cost:   O(N) scan (skeleton grouping) + O(Nskel) BFS — both much cheaper
 *
 * NOTE: This file requires an HTTP server. ES modules are blocked by CORS on file://.
 *   python3 -m http.server 8080  →  http://localhost:8080
 */

import { gpuInit }                             from './gpu/device.js';
import { runGPU, gpuComputeOBB }               from './gpu/pipeline.js';
import { runCPU_axes, runCPU_lines }           from './cpu/process.js';
import { gpuRenderOBB }                        from './render/obb.js';
import { showDebug, showLabelMap }             from './render/display.js';
import { initControls, setStatus, setProgress } from './ui/controls.js';
import { PALETTE, cfg }                        from './config.js';

let loadedImg = null, procW = 0, procH = 0, gpuReady = false, running = false;

initControls(
  (img, pw, ph) => { loadedImg = img; procW = pw; procH = ph; },
  runPipeline,
);

gpuInit()
  .then(() => {
    gpuReady = true;
    document.querySelector('.pipeline-steps').style.color = '#0d4040';
  })
  .catch(err => setStatus('WebGPU unavailable: ' + err.message, 'err'));

async function runPipeline() {
  if (!loadedImg || running) return;
  running = true;
  document.getElementById('detectBtn').disabled = true;
  const T0 = performance.now();
  let gpuResult = null;

  try {
    if (!gpuReady) {
      setStatus('Initialising WebGPU…', 'run'); setProgress(3);
      await gpuInit(); gpuReady = true;
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = procW; offscreen.height = procH;
    offscreen.getContext('2d').drawImage(loadedImg, 0, 0, procW, procH);
    const imageData = offscreen.getContext('2d').getImageData(0, 0, procW, procH);

    // ── Phase 1: GPU main pipeline ─────────────────────────────────────────
    setProgress(8);
    setStatus('GPU: gray → SAT → Sauvola → dilate → ZS → CCA∥ → stats∥…', 'run');
    gpuResult = await runGPU(imageData, cfg);
    setProgress(52);
    document.getElementById('s_gpu').textContent = gpuResult.tGPU + ' ms';
    document.getElementById('s_k').textContent   = gpuResult.K;

    showDebug('binCanvas', 'ph_bin', gpuResult.binary,   procW, procH);
    showDebug('dilCanvas', 'ph_dil', gpuResult.dilated,  procW, procH);
    showDebug('sklCanvas', 'ph_skl', gpuResult.skeleton, procW, procH);
    showLabelMap('lblCanvas', 'ph_lbl', gpuResult.labelArr, gpuResult.K, procW, procH);
    setProgress(62);

    // ── Phase 2: CPU axis derivation ───────────────────────────────────────
    setStatus('CPU: centroids + skeleton BFS → axis vectors…', 'run');
    const { centX, centY, axVX, axVY, skelByComp, valid } = runCPU_axes(gpuResult, cfg);
    setProgress(70);

    // ── Phase 3: GPU OBB projection (replaces 2× O(N) CPU passes) ─────────
    setStatus('GPU: PROJ_ACCUM∥ — projecting all pixels → OBB extents…', 'run');
    const obbF32 = await gpuComputeOBB(
      gpuResult.W, gpuResult.H, gpuResult.labelArr, gpuResult.K,
      centX, centY, axVX, axVY
    );
    setProgress(82);

    // ── Phase 4: CPU line object assembly ──────────────────────────────────
    setStatus('CPU: assembling line objects from GPU OBB data…', 'run');
    const lines = runCPU_lines(obbF32, skelByComp, valid, gpuResult.K, cfg, procW, procH);
    setProgress(88);

    // ── Phase 5: GPU rendering ─────────────────────────────────────────────
    setStatus('GPU: RENDER∥ — drawing OBBs in parallel…', 'run');
    const renderedPixels = await gpuRenderOBB(gpuResult.rgbaBuf, procW, procH, lines);
    gpuResult.rgbaBuf.destroy(); gpuResult.rgbaBuf = null;
    setProgress(94);

    // ── Composite output ───────────────────────────────────────────────────
    const outCanvas = document.createElement('canvas');
    outCanvas.width = procW; outCanvas.height = procH;
    const ctx  = outCanvas.getContext('2d');
    const imgD = ctx.createImageData(procW, procH);
    for (let i = 0; i < procW * procH; i++) {
      const p = renderedPixels[i];
      imgD.data[i*4]   =  p & 0xFF;
      imgD.data[i*4+1] = (p >> 8)  & 0xFF;
      imgD.data[i*4+2] = (p >> 16) & 0xFF;
      imgD.data[i*4+3] = (p >> 24) & 0xFF;
    }
    ctx.putImageData(imgD, 0, 0);
    lines.forEach((line, idx) => {
      const col = PALETTE[idx % PALETTE.length], pl = line.polyline;
      if (pl && pl.length > 1) {
        ctx.beginPath(); ctx.moveTo(pl[0].x, pl[0].y);
        for (let i = 1; i < pl.length; i++) ctx.lineTo(pl[i].x, pl[i].y);
        ctx.strokeStyle = col + 'bb'; ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
        const mx = pl.reduce((s,p)=>s+p.x,0)/pl.length;
        const my = pl.reduce((s,p)=>s+p.y,0)/pl.length;
        ctx.fillStyle = col; ctx.font = 'bold 14px monospace';
        ctx.fillText(String(idx+1), mx, my);
      }
    });

    document.getElementById('outputImg').src = outCanvas.toDataURL();
    document.getElementById('outputImg').style.display = 'block';
    document.getElementById('ph_output').style.display = 'none';
    document.getElementById('s_lines').textContent = lines.length;
    document.getElementById('s_total').textContent = Math.round(performance.now()-T0)+' ms';
    setProgress(100);

    const legend = document.getElementById('legend'); legend.style.display = 'flex';
    legend.innerHTML = lines.map((_,i) =>
      `<span class="legend-item"><span class="legend-dot" style="background:${PALETTE[i%PALETTE.length]}"></span>LINE ${i+1}</span>`
    ).join('');

    setStatus(`Done — ${lines.length} line(s) | ${gpuResult.K} blobs | GPU: ${gpuResult.tGPU} ms`, 'ok');

  } catch(err) {
    console.error(err);
    setStatus('ERROR: ' + err.message, 'err');
    setProgress(0);
    if (gpuResult?.rgbaBuf) gpuResult.rgbaBuf.destroy();
  }

  running = false;
  document.getElementById('detectBtn').disabled = false;
}
