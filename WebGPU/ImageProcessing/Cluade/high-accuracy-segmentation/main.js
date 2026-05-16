/**
 * main.js
 * Full pipeline orchestrator.
 * Drives stage execution, UI updates, and inter-stage data flow.
 */

import { Config } from './config.js';
import { buildAdaptiveParams } from './adaptiveParams.js';
import { GPUContext } from './core/gpuContext.js';
import { ResourceRegistry } from './core/resourceRegistry.js';
import { FrameGraph } from './core/frameGraph.js';
import { StrokeWidthStore } from './core/strokeWidthStore.js';

// ─── Stage imports ───────────────────────────────────────────────────────────
import { runQualityScorer } from './stages/00_adaptation/qualityScorer.js';
import { runDpiEstimator }   from './stages/00_adaptation/dpiEstimator.js';
import { resolveParams }     from './stages/00_adaptation/paramResolver.js';
import { resolveGating }     from './stages/00_adaptation/stageGating.js';
import { runDeskew }                from './stages/01_geometry/deskew.js';
import { runPerspectiveCorrect }    from './stages/01_geometry/perspectiveCorrect.js';
import { runBleedthrough }          from './stages/02_illumination/bleedthrough.js';
import { runRetinex }               from './stages/02_illumination/retinex.js';
import { runCLAHE }                 from './stages/02_illumination/clahe.js';
import { runBilateral }             from './stages/03_denoise/bilateral.js';
import { runNLM }                   from './stages/03_denoise/nlm.js';
import { runHough }                 from './stages/04_lineRemoval/hough.js';
import { runSauvola }               from './stages/05_threshold/sauvola.js';
import { runReconstruction }        from './stages/06_morphology/reconstruction.js';
import { runHoleFill }              from './stages/06_morphology/holeFill.js';
import { runSWT }                   from './stages/07_swt/swt.js';
import { runSWTQualityGate }        from './stages/07_swt/swtQualityGate.js';
import { runMeanStrokeExtract }     from './stages/07_swt/meanStrokeExtract.js';
import { runDistanceTransform }     from './stages/08_distance/distanceTransform.js';
import { runHMinima }               from './stages/09_hMinima/hMinimaSuppression.js';
import { runRegionalMaxima }        from './stages/10_markerExtraction/regionalMaxima.js';
import { runPeakProminence }        from './stages/10_markerExtraction/peakProminence.js';
import { runStrokeConsistency }     from './stages/10_markerExtraction/strokeConsistencyFilter.js';
import { runWatershed }             from './stages/11_watershed/watershed.js';
import { runWeakBoundary }          from './stages/11_watershed/weakBoundarySuppression.js';
import { runCCA }                   from './stages/12_cca/cca.js';
import { runGraphMergePhase1 }      from './stages/13_graphMerge_phase1/adjacencyGraph.js';
import { runSplitDetector }         from './stages/14_splitDetector/splitDetector.js';
import { runGraphMergePhase2 }      from './stages/15_graphMerge_phase2/adjacencyGraph.js';
import { runShapeFilter }           from './stages/16_shapeFilter/shapeFilter.js';
import { runBBoxExtract }           from './stages/17_boundingBoxes/bboxExtract.js';
import { runRenderBoxes }           from './stages/18_render/renderBoxes.js';

// ─── UI references ────────────────────────────────────────────────────────────
const canvas       = document.getElementById('mainCanvas');
const ctx2d        = canvas.getContext('2d');
const runBtn       = document.getElementById('runBtn');
const resetBtn     = document.getElementById('resetBtn');
const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const logPanel     = document.getElementById('logPanel');
const stageList    = document.getElementById('stageList');
const progressFill = document.getElementById('progressFill');
const gpuLabel     = document.getElementById('gpuLabel');
const noWebGPU     = document.getElementById('noWebGPU');

const STAGE_NAMES = [
  '00 Quality & Adaptation', '01 Geometry', '02 Illumination',
  '03 Denoising', '04 Line Removal', '05 Sauvola Threshold',
  '06 Morphology', '07 SWT', '08 Distance Transform',
  '09 h-Minima Suppression', '10 Marker Extraction', '11 Watershed',
  '12 CCA Labeling', '13 Graph Merge Phase 1', '14 Split Detector',
  '15 Graph Merge Phase 2', '16 Shape Filter', '17 Bounding Boxes', '18 Render',
];

// Build stage list UI
STAGE_NAMES.forEach((name, i) => {
  const el = document.createElement('div');
  el.className = 'stage-item';
  el.id = `stage-${i}`;
  el.innerHTML = `<div class="stage-dot"></div><span>${name}</span>`;
  stageList.appendChild(el);
});

let gpuCtx = null;
let sourceImageData = null;
let activeTab = 'input';
const intermediates = {};

// ─── GPU Init ─────────────────────────────────────────────────────────────────
async function initGPU() {
  try {
    gpuCtx = await GPUContext.create();
    gpuLabel.textContent = gpuCtx.adapterInfo?.description ?? 'WebGPU Ready';
    gpuLabel.style.color = '#4caf50';
    log('GPU adapter initialized', 'ok');
  } catch (e) {
    gpuLabel.textContent = 'WebGPU Unavailable';
    gpuLabel.style.color = '#f44336';
    noWebGPU.style.display = 'flex';
    canvas.style.display = 'none';
    log(e.message, 'err');
  }
}

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logPanel.appendChild(el);
  logPanel.scrollTop = logPanel.scrollHeight;
}

function setStageState(i, state) {
  const el = document.getElementById(`stage-${i}`);
  if (el) { el.className = `stage-item ${state}`; }
}

function setProgress(pct) {
  progressFill.style.width = `${pct}%`;
}

function updateParams(params, sws) {
  document.getElementById('p-dpi').textContent     = params.estimatedDPI?.toFixed(0) ?? '—';
  document.getElementById('p-quality').textContent = params.qualityVector?.contrastRatio?.toFixed(2) ?? '—';
  document.getElementById('p-stroke').textContent  = sws?.meanStrokeWidth?.toFixed(1) ?? '—';
  document.getElementById('p-sauvola').textContent = params.sauvolaK ?? '—';
  document.getElementById('p-hminima').textContent = '×' + params.hMinimaFactor?.toFixed(2) ?? '—';
  document.getElementById('p-merge').textContent   = params.mergeStrictGapFactor?.toFixed(2) ?? '—';
}

// ─── Image loading ─────────────────────────────────────────────────────────────
function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx2d.drawImage(img, 0, 0);
    sourceImageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    intermediates['input'] = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    document.getElementById('statusDims').textContent = `${img.naturalWidth}×${img.naturalHeight}`;
    URL.revokeObjectURL(url);
    runBtn.disabled = false;
    log(`Loaded: ${file.name} (${img.naturalWidth}×${img.naturalHeight})`, 'ok');
  };
  img.src = url;
}

dropZone.addEventListener('click',       () => fileInput.click());
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave',   () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
});

// Tab switching
document.querySelectorAll('.canvas-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.canvas-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    if (intermediates[activeTab]) {
      ctx2d.putImageData(intermediates[activeTab], 0, 0);
    }
  });
});

resetBtn.addEventListener('click', () => {
  if (sourceImageData) ctx2d.putImageData(sourceImageData, 0, 0);
  STAGE_NAMES.forEach((_, i) => setStageState(i, ''));
  setProgress(0);
  document.getElementById('statusStage').textContent      = 'Idle';
  document.getElementById('statusComponents').textContent = '—';
  document.getElementById('statusTime').textContent       = '—';
});

// ─── Main pipeline ────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runPipeline);

async function runPipeline() {
  if (!gpuCtx || !sourceImageData) return;
  runBtn.disabled = true;
  const t0 = performance.now();
  const total = STAGE_NAMES.length;
  let step = 0;

  const advance = (name, i) => {
    step++;
    setStageState(i, 'active');
    setProgress((step / total) * 100);
    document.getElementById('statusStage').textContent = name;
    log(`Running: ${name}`, 'info');
  };

  const done = (i, skipped = false) => {
    setStageState(i, skipped ? 'skipped' : 'done');
  };

  try {
    const registry = new ResourceRegistry(gpuCtx);
    const sws      = new StrokeWidthStore();

    // ── Stage 00: Adaptation ─────────────────────────────────────────────────
    advance('00 Quality & Adaptation', 0);
    const qualVec    = await runQualityScorer(gpuCtx, sourceImageData);
    const dpi        = await runDpiEstimator(gpuCtx, sourceImageData, qualVec);
    const stageFlags = resolveGating(qualVec, dpi);
    const params     = buildAdaptiveParams(qualVec, dpi, stageFlags);
    updateParams(params, sws);
    done(0);

    // ── Stage 01: Geometry ───────────────────────────────────────────────────
    advance('01 Geometry', 1);
    let workingTex = await gpuCtx.uploadImageData(sourceImageData);
    workingTex = await runDeskew(gpuCtx, workingTex, params, registry);
    workingTex = await runPerspectiveCorrect(gpuCtx, workingTex, params, registry);
    done(1);

    // ── Stage 02: Illumination ───────────────────────────────────────────────
    advance('02 Illumination', 2);
    if (params.bleedthroughEnabled) workingTex = await runBleedthrough(gpuCtx, workingTex, params, registry);
    if (params.retinexEnabled)      workingTex = await runRetinex(gpuCtx, workingTex, params, registry);
    workingTex = await runCLAHE(gpuCtx, workingTex, params, registry);
    done(2);

    // ── Stage 03: Denoise ────────────────────────────────────────────────────
    advance('03 Denoising', 3);
    workingTex = params.useNLM
      ? await runNLM(gpuCtx, workingTex, params, registry)
      : await runBilateral(gpuCtx, workingTex, params, registry);
    done(3);

    // ── Stage 04: Line Removal ───────────────────────────────────────────────
    advance('04 Line Removal', 4);
    workingTex = await runHough(gpuCtx, workingTex, params, registry);
    done(4);

    // ── Stage 05: Threshold ──────────────────────────────────────────────────
    advance('05 Sauvola Threshold', 5);
    let binaryTex = await runSauvola(gpuCtx, workingTex, params, sws, registry);
    intermediates['threshold'] = await gpuCtx.downloadToImageData(binaryTex);
    done(5);

    // ── Stage 06: Morphology ─────────────────────────────────────────────────
    advance('06 Morphology', 6);
    binaryTex = await runReconstruction(gpuCtx, binaryTex, params, registry);
    if (stageFlags.holeFill) binaryTex = await runHoleFill(gpuCtx, binaryTex, params, registry);
    done(6);

    // ── Stage 07: SWT ────────────────────────────────────────────────────────
    advance('07 SWT', 7);
    const swtMap    = await runSWT(gpuCtx, binaryTex, params, registry);
    const swtQuality = await runSWTQualityGate(gpuCtx, swtMap, params);
    await runMeanStrokeExtract(gpuCtx, swtMap, swtQuality, sws, registry);
    updateParams(params, sws);
    intermediates['swt'] = await gpuCtx.downloadToImageData(swtMap);
    done(7);

    // ── Stage 08: Distance Transform ─────────────────────────────────────────
    advance('08 Distance Transform', 8);
    let distTex = await runDistanceTransform(gpuCtx, binaryTex, registry);
    done(8);

    // ── Stage 09: h-Minima ───────────────────────────────────────────────────
    advance('09 h-Minima Suppression', 9);
    distTex = await runHMinima(gpuCtx, distTex, sws, params, registry);
    done(9);

    // ── Stage 10: Marker Extraction ──────────────────────────────────────────
    advance('10 Marker Extraction', 10);
    let markerTex = await runRegionalMaxima(gpuCtx, distTex, registry);
    markerTex = await runPeakProminence(gpuCtx, markerTex, distTex, params, registry);
    markerTex = await runStrokeConsistency(gpuCtx, markerTex, swtMap, sws, params, registry);
    done(10);

    // ── Stage 11: Watershed ──────────────────────────────────────────────────
    advance('11 Watershed', 11);
    let labelTex = await runWatershed(gpuCtx, distTex, markerTex, binaryTex, registry);
    labelTex = await runWeakBoundary(gpuCtx, labelTex, workingTex, params, registry);
    intermediates['watershed'] = await gpuCtx.downloadToImageData(labelTex);
    done(11);

    // ── Stage 12: CCA ────────────────────────────────────────────────────────
    advance('12 CCA Labeling', 12);
    const ccaResult = await runCCA(gpuCtx, labelTex, registry);
    document.getElementById('statusComponents').textContent = ccaResult.componentCount;
    done(12);

    // ── Stage 13: Graph Merge Phase 1 ────────────────────────────────────────
    advance('13 Graph Merge Phase 1', 13);
    let mergedLabels = await runGraphMergePhase1(gpuCtx, ccaResult, sws, params, registry);
    done(13);

    // ── Stage 14: Split Detector ─────────────────────────────────────────────
    advance('14 Split Detector', 14);
    const splitDecisions = await runSplitDetector(gpuCtx, mergedLabels, binaryTex, swtMap, sws, params, registry);
    done(14);

    // ── Stage 15: Graph Merge Phase 2 ────────────────────────────────────────
    advance('15 Graph Merge Phase 2', 15);
    mergedLabels = await runGraphMergePhase2(gpuCtx, mergedLabels, splitDecisions, sws, params, registry);
    done(15);

    // ── Stage 16: Shape Filter ───────────────────────────────────────────────
    advance('16 Shape Filter', 16);
    const filteredLabels = await runShapeFilter(gpuCtx, mergedLabels, sws, params, registry);
    done(16);

    // ── Stage 17: Bounding Boxes ─────────────────────────────────────────────
    advance('17 Bounding Boxes', 17);
    const bboxes = await runBBoxExtract(gpuCtx, filteredLabels, registry);
    done(17);

    // ── Stage 18: Render ─────────────────────────────────────────────────────
    advance('18 Render', 18);
    const outputTex = await runRenderBoxes(gpuCtx, workingTex, bboxes, params, registry);
    const outputData = await gpuCtx.downloadToImageData(outputTex);
    intermediates['output'] = outputData;
    ctx2d.putImageData(outputData, 0, 0);
    done(18);

    registry.releaseAll();

    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    document.getElementById('statusTime').textContent = `${elapsed}s`;
    document.getElementById('statusComponents').textContent = bboxes.length;
    setProgress(100);
    log(`Pipeline complete — ${bboxes.length} characters found in ${elapsed}s`, 'ok');
  } catch (err) {
    log(`Pipeline error: ${err.message}`, 'err');
    console.error(err);
  } finally {
    runBtn.disabled = false;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initGPU();
