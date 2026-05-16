/**
 * @file main.js
 * @description Application entry point — imports all modules and orchestrates
 * the full Sauvola WebGPU document binarisation pipeline.
 *
 * Module dependency graph
 * ───────────────────────
 *
 *   config.js ──────────────────────────────────────────────────┐
 *   shaders.js ──────────────────────────────────┐              │
 *   gpu.js  (uses shaders.js, config.js) ────────┤              │
 *   connectedComponents.js ───────────────────────┤              │
 *   charSeparation.js (uses config.js) ───────────┤              │
 *   charFilter.js (uses config.js) ────────────────┤             │
 *   rendering.js (uses config.js) ─────────────────┤             │
 *   demo.js ──────────────────────────────────────┤             │
 *   ui.js (uses config.js) ──────────────────────┤             │
 *   main.js ◄──────────────────────────────────────────────────┘
 *
 * Pipeline execution order (triggered by "Run Pipeline" button)
 * ─────────────────────────────────────────────────────────────
 *
 *  Step 0  GPU pass 1 — RGBA → greyscale + SAT seed          (SH_GRAY)
 *  Step 1  GPU pass 2 — Horizontal prefix sum                 (SH_ROW)
 *  Step 2  GPU pass 3 — Vertical prefix sum → complete SAT    (SH_COL)
 *  Step 3  GPU pass 4 — Sauvola adaptive threshold            (SH_SAUVOLA)
 *          → binary[] + gray[] copied back to CPU
 *
 *  Step 4  CPU — Connected components (8-connected DFS)
 *          → labels[] + regions[]
 *
 *  Step 5  CPU — Touching character separation (projection-profile valleys)
 *          → splitRegions[]
 *
 *  Step 6  CPU — Character-like filter (aspect / density / size heuristics)
 *          → charRegions[]
 *          → renderFeatures (panel 04)
 *          → renderBoxes    (panel 05)
 *          → stats update
 *
 * All inter-step yields (setTimeout 0) allow the browser to repaint the
 * loading overlay and pipeline indicator between heavy CPU operations.
 */

// ── IMPORTS ───────────────────────────────────────────────────────────────────

import { DEFAULT_WIN_SIZE, DEFAULT_K, DEFAULT_MIN_AREA } from './config.js';
import { initGPU, runSauvola }                           from './gpu.js';
import { connectedComponents }                            from './connectedComponents.js';
import { splitAllRegions }                                from './charSeparation.js';
import { isCharacterLike }                                from './charFilter.js';
import {
  renderGray,
  renderBinary,
  renderFeatures,
  renderBoxes,
} from './rendering.js';
import { generateDemo }   from './demo.js';
import {
  $,
  showError,
  setStep,
  showCanvas,
  getCurrentImage,
  setCurrentImage,
  initSliders,
  initDropZone,
} from './ui.js';

// ── BUTTON EVENT HANDLERS ─────────────────────────────────────────────────────

/**
 * Handle the "New Demo Image" button.
 *
 * Calls `generateDemo()` which cycles through three synthetic document themes
 * and sets the result as the current image, enabling the Run button.
 */
$('demoBtn').addEventListener('click', () => {
  const img = generateDemo();
  // _demoN is internal to demo.js; we read the cycle counter indirectly via
  // the info string produced by setCurrentImage.
  setCurrentImage(img, `640×480 · demo`);
});

/**
 * Handle the "Run Pipeline" button.
 *
 * Reads the three slider values, executes all seven pipeline steps in order,
 * and updates the five output panels plus the stats bar.  All heavy work is
 * done asynchronously; UI feedback (loading overlay, step indicator) is
 * updated between steps.
 *
 * Error handling: any thrown error surfaces in the red error banner.
 * The Run button and loading overlay are always restored in the `finally` block.
 */
$('processBtn').addEventListener('click', async () => {
  const currentImgData = getCurrentImage();
  if (!currentImgData) return;

  // ── Disable controls and show loading state ───────────────────────────
  $('processBtn').disabled     = true;
  $('processBtn').textContent  = '⏳ Running…';
  $('loadingOverlay').style.display = 'flex';
  $('loadingMsg').textContent  = 'RUNNING GPU SHADERS…';
  $('errBanner').style.display = 'none';

  try {
    const W = currentImgData.width;
    const H = currentImgData.height;

    // Read user-supplied parameters from sliders
    const winSize = parseInt($('winSlider').value);
    const k       = parseFloat($('kSlider').value);
    const minArea = parseInt($('areaSlider').value);

    // ── STEPS 0–3: GPU binarisation ──────────────────────────────────
    // setStep() calls within runSauvola() advance the pipeline indicator
    // as each GPU pass is submitted.  The actual GPU work is asynchronous;
    // execution continues from the `await` after the GPU queue is drained.
    const { binary, gray, gpuMs } = await runSauvola(currentImgData, winSize, k);

    // ── Panel 02: Greyscale ──────────────────────────────────────────
    renderGray($('cGray'), gray, W, H);
    showCanvas('cGray', 'phGray');

    // ── Panel 03: Sauvola binary ──────────────────────────────────────
    renderBinary($('cBinary'), binary, W, H);
    showCanvas('cBinary', 'phBinary');
    $('binaryInfo').textContent = `w=${winSize} · k=${k.toFixed(2)}`;

    // ── STEP 4: Connected components ─────────────────────────────────
    setStep(4);
    $('loadingMsg').textContent = 'CONNECTED COMPONENTS…';
    await new Promise(r => setTimeout(r, 0));   // yield for UI repaint

    const { labels, regions, cpuMs, totalIds } =
      connectedComponents(binary, W, H, minArea);

    // ── STEP 5: Touching-character separation ─────────────────────────
    setStep(5);
    $('loadingMsg').textContent = 'SPLITTING TOUCHING CHARS…';
    await new Promise(r => setTimeout(r, 0));

    // minSplitArea is a fraction of minArea so that sub-regions of a
    // valid character are not discarded as noise.
    const minSplitArea = Math.max(4, Math.round(minArea / 4));
    const splitRegions = splitAllRegions(binary, labels, regions, W, H, minSplitArea);

    // ── STEP 6: Character-like filter + rendering ─────────────────────
    setStep(6);
    $('loadingMsg').textContent = 'FILTERING & RENDERING…';
    await new Promise(r => setTimeout(r, 0));

    const charRegions = splitRegions.filter(r => isCharacterLike(r, W, H));
    const splitCount  = charRegions.length - regions.length;

    // Panel 04: Feature colours (one colour per sub-region)
    const textPx = renderFeatures($('cFeat'), binary, labels, charRegions, W, H);
    showCanvas('cFeat', 'phFeat');
    $('featInfo').textContent =
      `${charRegions.length} regions · ${textPx.toLocaleString()} px`;

    // Panel 05: Bounding boxes over dimmed original
    renderBoxes($('cBoxes'), currentImgData, charRegions, W, H);
    showCanvas('cBoxes', 'phBoxes');
    $('boxInfo').textContent =
      `${charRegions.length} chars` +
      ` (${splitCount > 0 ? '+' + splitCount + ' split' : 'no splits'})` +
      ` · ${totalIds} components`;

    // ── Stats bar update ─────────────────────────────────────────────
    $('sRegions').textContent = charRegions.length;
    $('sPixels').textContent  = textPx > 999
      ? (textPx / 1000).toFixed(1) + 'k'
      : textPx;
    $('sGpu').textContent     = gpuMs.toFixed(1) + 'ms';
    $('sCpu').textContent     = cpuMs.toFixed(1) + 'ms';

    // Clear the pipeline step indicator
    document.querySelectorAll('.pipe-step').forEach(el => el.classList.remove('active'));

  } catch (err) {
    showError(err.message);
    console.error(err);
  } finally {
    // Always restore controls regardless of success or failure
    $('processBtn').disabled    = false;
    $('processBtn').textContent = '▶ Run Pipeline';
    $('loadingOverlay').style.display = 'none';
  }
});

// ── INITIALISATION ────────────────────────────────────────────────────────────

/**
 * Bootstrap sequence:
 *  1. Wire sliders → labels.
 *  2. Wire drop zone events.
 *  3. Request WebGPU device.
 *  4. Generate and display the first demo image.
 *  5. Auto-trigger the pipeline so the user sees output immediately.
 *
 * The 120 ms delay before auto-triggering gives the browser time to paint the
 * demo image on the original canvas before the loading overlay appears.
 */
(async () => {
  try {
    initSliders();
    initDropZone();

    await initGPU();

    const img = generateDemo();
    setCurrentImage(img, `640×480 · demo #1`);

    // Small delay so the browser renders the original canvas first
    await new Promise(r => setTimeout(r, 120));
    $('processBtn').click();

  } catch (err) {
    showError(err.message);
  }
})();
