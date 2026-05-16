/**
 * main.js
 * ═══════════════════════════════════════════════════════════════════════
 * Max Inscribed Circle  ·  All-GPU WebGPU Pipeline
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Import tree:
 *
 *   main.js
 *   ├── gpu/
 *   │   ├── init.js          WebGPU adapter + device init
 *   │   └── utils.js         makeUniformBuffer, makeComputePipeline, …
 *   ├── shaders/
 *   │   ├── seed.js          WGSL_SEED
 *   │   ├── jfa.js           WGSL_JFA
 *   │   ├── dist.js          wgslDist(fp16)
 *   │   ├── reduce.js        wgslDistReduce(fp16), WGSL_REDUCE
 *   │   └── extract.js       WGSL_EXTRACT
 *   ├── pipeline/
 *   │   ├── stage0-upload.js  Binary texture → GPU
 *   │   ├── stage1-seed.js    Seed init
 *   │   ├── stage2-jfa.js     Jump Flood passes
 *   │   ├── stage3-dist.js    Distance field (f32|f16)
 *   │   ├── stage4-reduce.js  Parallel max reduction cascade
 *   │   └── stage5-extract.js Final circle readback
 *   └── ui/
 *       ├── log.js            log(), clearLog()
 *       ├── pipeline-ui.js    setStage(), allDone(), showResult(), …
 *       ├── image-upload.js   drag-drop upload + live binarisation
 *       ├── canvas-draw.js    brush drawing on mask canvas
 *       ├── presets.js        built-in shape presets
 *       ├── overlay.js        circle overlay renderer
 *       └── distfield.js      thermal distance field + f16 decoder
 */

// ── GPU ──────────────────────────────────────────────────────────────────
import { gpuState, initGPU }                        from './gpu/init.js';
import { makeUniformBuffer, makeComputePipeline,
         makeStorageBuffer, makeStagingBuffer }      from './gpu/utils.js';

// ── Shaders ───────────────────────────────────────────────────────────────
import { WGSL_SEED }                                 from './shaders/seed.js';
import { WGSL_JFA }                                  from './shaders/jfa.js';
import { wgslDist }                                  from './shaders/dist.js';
import { wgslDistReduce, WGSL_REDUCE }               from './shaders/reduce.js';
import { WGSL_EXTRACT }                              from './shaders/extract.js';

// ── Pipeline stages ───────────────────────────────────────────────────────
import { stage0Upload }                              from './pipeline/stage0-upload.js';
import { stage1BindGroup }                           from './pipeline/stage1-seed.js';
import { stage2JFA, buildJFAUniforms }               from './pipeline/stage2-jfa.js';
import { stage3Dist, distBufferSize }                from './pipeline/stage3-dist.js';
import { stage4Reduce, reduceCounts,
         finalReduceBuffer }                         from './pipeline/stage4-reduce.js';
import { stage5Extract, readCircleResult }           from './pipeline/stage5-extract.js';

// ── UI ────────────────────────────────────────────────────────────────────
import { log, clearLog }                             from './ui/log.js';
import { setStage, allDone, resetStages,
         updateResUI, showTiming, showResult }       from './ui/pipeline-ui.js';
import { setupUpload, applyBinaryMask,
         uploadState }                               from './ui/image-upload.js';
import { setupDrawCanvas, clearCanvas }              from './ui/canvas-draw.js';
import { drawPreset, PRESETS }                       from './ui/presets.js';
import { drawCircleOverlay, clearOverlay }           from './ui/overlay.js';
import { drawDistField, decodeF16 }                  from './ui/distfield.js';

// ════════════════════════════════════════════════════════════════════════════
//  CANVAS REFERENCES
// ════════════════════════════════════════════════════════════════════════════
const drawCanvas    = document.getElementById('drawCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const distCanvas    = document.getElementById('distCanvas');
const dctx          = drawCanvas.getContext('2d', { willReadFrequently: true });
const octx          = overlayCanvas.getContext('2d');
const fctx          = distCanvas.getContext('2d');

// Current canvas dimensions (updated when image is loaded)
let CW = 380, CH = 380;

// ── Resize all canvases together ─────────────────────────────────────────
function resizeCanvases(W, H) {
  CW = W; CH = H;
  for (const c of [drawCanvas, overlayCanvas, distCanvas]) {
    c.width        = W;
    c.height       = H;
    c.style.width  = W + 'px';
    c.style.height = H + 'px';
  }
  updateResUI(W, H);
  // Clear dist canvas after resize
  fctx.fillStyle = '#111';
  fctx.fillRect(0, 0, W, H);
}

// ════════════════════════════════════════════════════════════════════════════
//  FULL GPU PIPELINE
// ════════════════════════════════════════════════════════════════════════════
async function runMaxCircle() {
  const { device, fp16 } = gpuState;
  if (!device) { log('GPU not ready — init failed', 'err'); return; }

  const W     = CW, H = CH, TOTAL = W * H;
  const btnRun = document.getElementById('btnRun');
  btnRun.disabled = true;

  clearLog();
  log('══════════ MAX CIRCLE PIPELINE ══════════');
  resetStages();

  // ── Stage 0: Binary texture upload ──────────────────────────────────
  setStage(0);
  const { tex } = stage0Upload(device, drawCanvas, W, H);

  // ── Allocate all GPU buffers ─────────────────────────────────────────
  const dSz             = distBufferSize(TOTAL, fp16);
  const { r1Count, r2Count, r3Count, needR3 } = reduceCounts(TOTAL);
  const jN              = Math.ceil(Math.log2(Math.max(W, H)));

  const pingBuf  = makeStorageBuffer(device, TOTAL * 8);
  const pongBuf  = makeStorageBuffer(device, TOTAL * 8);
  const distBuf  = makeStorageBuffer(device, dSz,      true);   // COPY_SRC for readback
  const r1Buf    = makeStorageBuffer(device, r1Count * 8);
  const r2Buf    = makeStorageBuffer(device, Math.max(r2Count * 8, 8));
  const r3Buf    = needR3 ? makeStorageBuffer(device, Math.max(r3Count * 8, 8)) : null;
  const resBuf   = makeStorageBuffer(device, 16,        true);   // COPY_SRC for result
  const stgRes   = makeStagingBuffer(device, 16);
  const stgDist  = makeStagingBuffer(device, dSz);

  // ── Uniforms ─────────────────────────────────────────────────────────
  const uDims    = makeUniformBuffer(device, new Uint32Array([W,       H, 0, 0]));
  const uR1      = makeUniformBuffer(device, new Uint32Array([TOTAL,   0, 0, 0]));
  const uR2      = makeUniformBuffer(device, new Uint32Array([r1Count, 0, 0, 0]));
  const uR3      = needR3 ? makeUniformBuffer(device, new Uint32Array([r2Count, 0, 0, 0])) : null;
  const finalCnt = needR3 ? r3Count : r2Count;
  const uExt     = makeUniformBuffer(device, new Uint32Array([finalCnt, W, 0, 0]));
  const jfaU     = buildJFAUniforms(device, W, H, makeUniformBuffer);

  // ── Compile all pipelines ─────────────────────────────────────────────
  const pSeed  = makeComputePipeline(device, WGSL_SEED,             'seedInit');
  const pJFA   = makeComputePipeline(device, WGSL_JFA,              'jfa');
  const pDist  = makeComputePipeline(device, wgslDist(fp16),        'distField');
  const pDRed  = makeComputePipeline(device, wgslDistReduce(fp16),  'distReduce');
  const pRed   = makeComputePipeline(device, WGSL_REDUCE,            'reduce');
  const pExt   = makeComputePipeline(device, WGSL_EXTRACT,           'extract');

  // ── Encode everything into ONE command buffer ─────────────────────────
  const t0  = performance.now();
  const enc = device.createCommandEncoder({ label: 'maxCircle' });
  const cp  = enc.beginComputePass({ label: 'all-stages' });

  // Stage 1 — Seed Init
  setStage(1);
  cp.setPipeline(pSeed);
  cp.setBindGroup(0, stage1BindGroup(device, pSeed, tex, pingBuf, uDims));
  cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
  log(`[1] SeedInit  ${Math.ceil(W/8)}×${Math.ceil(H/8)} wg`, 'info');

  // Stage 2 — Jump Flood Algorithm
  setStage(2);
  const jfaResult = stage2JFA(cp, pJFA, device, pingBuf, pongBuf, jfaU, W, H);

  // Stage 3 — Distance Field
  setStage(3);
  stage3Dist(cp, pDist, device, jfaResult, distBuf, uDims, W, H, fp16);

  // Stage 4 — Parallel Max Reduction
  setStage(4);
  stage4Reduce(
    cp, pDRed, pRed, device,
    { distBuf, r1Buf, r2Buf, r3Buf },
    { uR1, uR2, uR3 },
    { r1Count, r2Count, r3Count, needR3 },
    TOTAL, fp16,
  );

  // Stage 5 — Extract Circle
  setStage(5);
  const finalIn = finalReduceBuffer({ r2Buf, r3Buf }, needR3);
  stage5Extract(cp, pExt, device, finalIn, resBuf, uExt);

  cp.end();

  // Copy 16-byte result + dist field to CPU-mappable staging buffers
  enc.copyBufferToBuffer(resBuf,  0, stgRes,  0, 16);
  enc.copyBufferToBuffer(distBuf, 0, stgDist, 0, dSz);

  // ── SINGLE GPU SUBMIT — all passes in one call ────────────────────────
  device.queue.submit([enc.finish()]);
  await device.queue.onSubmittedWorkDone();
  const gpuMs = performance.now() - t0;

  // ── Read back ONLY 16 bytes (circle center + radius) ─────────────────
  const { cx, cy, radius } = await readCircleResult(stgRes);

  // ── Read dist field for display (CPU decode needed for visualisation) ─
  await stgDist.mapAsync(GPUMapMode.READ);
  const rawDist  = stgDist.getMappedRange().slice(0);
  stgDist.unmap();
  const distF32  = fp16
    ? decodeF16(new Uint8Array(rawDist), TOTAL)
    : new Float32Array(rawDist);

  // ── Update UI ─────────────────────────────────────────────────────────
  allDone();
  showTiming(gpuMs);
  showResult(cx, cy, radius);

  drawDistField(fctx, distF32, W, H);
  drawCircleOverlay(octx, cx, cy, radius, W, H);

  document.getElementById('distLabel').textContent =
    `(thermal · r_max = ${radius.toFixed(1)} px)`;

  log(`\n✓ CIRCLE: cx=${cx}  cy=${cy}  r=${radius.toFixed(2)} px`, 'ok');
  log(`  GPU time: ${gpuMs.toFixed(1)} ms  (${fp16 ? 'f16' : 'f32'})`, 'ok');

  // ── Destroy GPU resources ─────────────────────────────────────────────
  [pingBuf, pongBuf, distBuf, r1Buf, r2Buf, resBuf, stgRes, stgDist,
   tex, uDims, uR1, uR2, uExt, ...jfaU]
    .forEach(b => b?.destroy?.());
  r3Buf?.destroy();
  uR3?.destroy();

  btnRun.disabled = false;
}

// ════════════════════════════════════════════════════════════════════════════
//  PRESET BUTTONS
// ════════════════════════════════════════════════════════════════════════════
function loadPreset(name) {
  uploadState.image = null;  // clear any uploaded image reference

  resizeCanvases(380, 380);
  drawPreset(name, dctx, 380, 380);
  clearOverlay(octx, CW, CH);
  fctx.fillStyle = '#111'; fctx.fillRect(0, 0, CW, CH);

  const rbox = document.getElementById('rbox');
  if (rbox) rbox.classList.remove('show');

  const dzName    = document.getElementById('dzName');
  const srcLabel  = document.getElementById('srcLabel');
  if (dzName)   dzName.style.display = 'none';
  if (srcLabel) srcLabel.textContent  = `(preset: ${name})`;
}

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => loadPreset(btn.dataset.p));
});
document.getElementById('btnPreset')?.addEventListener('click', () => loadPreset('room'));

// ── Clear button ──────────────────────────────────────────────────────────
document.getElementById('btnClear')?.addEventListener('click', () => {
  uploadState.image = null;
  clearCanvas(drawCanvas, overlayCanvas);
  fctx.fillStyle = '#111'; fctx.fillRect(0, 0, CW, CH);
  document.getElementById('rbox')?.classList.remove('show');
  document.getElementById('dzName').style.display = 'none';
  document.getElementById('srcLabel').textContent  = '(draw or upload)';
});

// ── Run button ────────────────────────────────────────────────────────────
document.getElementById('btnRun')?.addEventListener('click', runMaxCircle);

// ════════════════════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════════════════════
(async () => {
  // 1. Wire up manual drawing
  setupDrawCanvas(drawCanvas, overlayCanvas);

  // 2. Wire up image upload (also handles threshold / channel / invert)
  setupUpload(drawCanvas, (W, H) => {
    resizeCanvases(W, H);
    clearOverlay(octx, W, H);
    document.getElementById('rbox')?.classList.remove('show');
  });

  // 3. Init WebGPU
  const ok = await initGPU();
  if (ok) {
    document.getElementById('btnRun').disabled = false;
    log('Ready — draw a mask, upload an image, or pick a preset.', 'ok');
  }

  // 4. Load default preset
  loadPreset('room');
})();
