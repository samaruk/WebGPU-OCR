/**
 * main.js
 * Orchestrates the three-stage WebGPU OCR pipeline.
 *
 *  Stage 1 — Preprocessing  (preprocessing/preprocessing.js + .wgsl)
 *  Stage 2 — Text Detection  (detection/detection.js       + .wgsl)
 *  Stage 3 — CNN Features    (cnn/cnn.js                   + .wgsl)
 */

import { initWebGPU, drawLetterBoundaries } from './utils/webgpu-utils.js';
import { PreprocessingPipeline } from './preprocessing/preprocessing.js';
import { TextDetectionPipeline  } from './detection/detection.js';
import { CNNPipeline            } from './cnn/cnn.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('fileInput');
const runBtn     = document.getElementById('runBtn');
const statusBar  = document.getElementById('statusBar');
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const gpuWarning = document.getElementById('gpuWarning');

const canvases = {
  // Preprocessing
  original: document.getElementById('canvasOriginal'),
  gray:     document.getElementById('canvasGray'),
  clahe:    document.getElementById('canvasCLAHE'),
  guided:   document.getElementById('canvasGuided'),
  binary:   document.getElementById('canvasBinary'),
  // Detection
  edge:        document.getElementById('canvasEdge'),
  probability: document.getElementById('canvasProb'),
  detected:    document.getElementById('canvasDetected'),
  // CNN
  cnnGrid:   document.getElementById('canvasCNNGrid'),
  cnnPooled: document.getElementById('canvasCNNPooled'),
  // Letter boundaries (rendered after preprocessing, shown in Detection section)
  letterBounds: document.getElementById('canvasLetterBounds'),
};

// Placeholder ids to hide when canvases are populated
const placeholders = ['phOriginal','phGray','phCLAHE','phGuided','phBinary',
                      'phEdge','phProb','phDetected','phLetterBounds',
                      'phCNNGrid','phCNNPooled'];

// Section timing displays
const prepTimingEl = document.getElementById('prepTiming');
const detTimingEl  = document.getElementById('detTiming');
const cnnTimingEl  = document.getElementById('cnnTiming');

// ── State ─────────────────────────────────────────────────────────────────────
let device      = null;
let prepPipeline = null;
let detPipeline  = null;
let cnnPipeline  = null;
let uploadedImg  = null;

// ── Initialise WebGPU ─────────────────────────────────────────────────────────
async function bootstrap() {
  setStatus('Initialising WebGPU…', 'running');
  try {
    ({ device } = await initWebGPU());
  } catch (err) {
    gpuWarning.style.display = 'block';
    gpuWarning.textContent   = `⚠ ${err.message}`;
    setStatus('WebGPU unavailable', 'error');
    return;
  }

  setStatus('Compiling shaders…', 'running');
  prepPipeline = new PreprocessingPipeline(device);
  detPipeline  = new TextDetectionPipeline(device);
  cnnPipeline  = new CNNPipeline(device);

  await Promise.all([
    prepPipeline.init(),
    detPipeline.init(),
    cnnPipeline.init(),
  ]);

  setStatus('Ready — drop or upload an image', 'done');
  statusBar.style.display = 'flex';
}

// ── Image upload / drag-drop ──────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => loadFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadFile(file);
});

function loadFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    uploadedImg = img;
    URL.revokeObjectURL(url);
    dropZone.innerHTML = `
      <div class="icon">✓</div>
      <h3>${file.name}</h3>
      <p>${img.naturalWidth} × ${img.naturalHeight} px</p>`;
    runBtn.style.display = 'block';
    setStatus(`Image loaded: ${file.name}`, 'done');
  };
  img.src = url;
}

// ── Run pipeline ──────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runPipeline);

async function runPipeline() {
  if (!uploadedImg || !device) return;
  runBtn.disabled = true;
  hidePlaceholders();
  showSections();

  const total0 = performance.now();

  try {
    // ── Stage 1 : Preprocessing ──────────────────────────────────────────────
    setStatus('Stage 1/3 — Preprocessing (Grayscale → Blur → Binarize)…', 'running');
    const prepResult = await prepPipeline.run(uploadedImg, {
      original: canvases.original,
      gray:     canvases.gray,
      clahe:    canvases.clahe,
      guided:   canvases.guided,
      binary:   canvases.binary,
    });
    renderTimings(prepTimingEl, prepResult.timings, [
      ['Grayscale',     'grayscale'],
      ['CLAHE',         'clahe'],
      ['Guided Filter', 'guidedFilter'],
      ['Sauvola',       'sauvola'],
      ['Total',         'total'],
    ]);

    // ── Letter boundaries — connected components on binary map ───────────────
    setStatus('Segmenting individual letters…', 'running');
    const letterCount = drawLetterBoundaries(
      canvases.letterBounds,
      prepResult.binaryData,
      prepResult.width,
      prepResult.height,
    );

    // ── Stage 2 : Text Detection ─────────────────────────────────────────────
    setStatus('Stage 2/3 — Text Detection (Sobel → Probability → Dilation)…', 'running');
    const detResult = await detPipeline.run(
      prepResult.guidedData,
      prepResult.width,
      prepResult.height,
      {
        edge:        canvases.edge,
        probability: canvases.probability,
        detected:    canvases.detected,
      },
    );
    renderTimings(detTimingEl, detResult.timings, [
      ['Sobel', 'sobel'],
      ['Prob Map', 'probMap'],
      ['Dilation', 'dilate'],
      ['CPU BBox', 'cpuBBoxes'],
      ['Total', 'total'],
    ]);

    // ── Stage 3 : CNN Feature Extraction ─────────────────────────────────────
    setStatus('Stage 3/3 — CNN Feature Extraction (8 filters)…', 'running');
    const cnnResult = await cnnPipeline.run(
      prepResult.guidedData,
      prepResult.width,
      prepResult.height,
      {
        cnnGrid:   canvases.cnnGrid,
        cnnPooled: canvases.cnnPooled,
      },
    );
    renderTimings(cnnTimingEl, cnnResult.timings, [
      ['8 Filters', 'total'],
      ['Per Filter', 'perFilter'],
    ]);

    const elapsed = ((performance.now() - total0) / 1000).toFixed(2);
    setStatus(`✓ Pipeline complete — ${elapsed}s · ${detResult.boxes.length} text regions · ${letterCount} letters`, 'done');

  } catch (err) {
    console.error('[Pipeline Error]', err);
    setStatus(`✗ Error: ${err.message}`, 'error');
  }

  runBtn.disabled = false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStatus(msg, state = 'running') {
  statusBar.style.display = 'flex';
  statusText.textContent  = msg;
  statusDot.className = 'status-dot';
  if (state === 'done')  statusDot.classList.add('done');
  if (state === 'error') statusDot.classList.add('error');
}

function hidePlaceholders() {
  placeholders.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showSections() {
  ['prepSection','detSection','cnnSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = '';
      requestAnimationFrame(() => el.classList.add('visible'));
    }
  });
}

function renderTimings(el, timings, pairs) {
  el.innerHTML = pairs.map(([label, key]) => {
    const ms = timings[key] != null ? timings[key].toFixed(1) : '—';
    return `<div class="timing-item">${label}: <span>${ms}ms</span></div>`;
  }).join('');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
bootstrap();
