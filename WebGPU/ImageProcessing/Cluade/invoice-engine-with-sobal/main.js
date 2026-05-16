// main.js – Invoice Engine · Top-level orchestrator
// Wires GPU context, pipeline stages, and UI together.

import { Config }               from './config.js';
import { GPUContext }           from './core/gpuContext.js';
import { TextureManager }       from './core/textureManager.js';
import { BufferManager }        from './core/bufferManager.js';
import { PipelineCache }        from './core/pipelineCache.js';
import { Profiler }             from './core/profiler.js';
import { ResourceTracker }      from './core/resourceTracker.js';

import { uploadTexture }        from './stages/01_uploadTexture.js';
import { sobelEdgeDetection }   from './stages/02_sobalEdgeDetection.js';
import { adaptiveThreshold }    from './stages/03_adaptiveThreshold.js';
import { jfaInit }              from './stages/04_jfaInit.js';
import { jfaJumpPass }          from './stages/05_jfaJumpPass.js';
import { sdfLocalMax }          from './stages/06_sdfLocalMax.js';
import { morphologyHorizontal } from './stages/07_morphologyHorizontal.js';
import { morphologyVertical }   from './stages/08_morphologyVertical.js';
import { projectionRowLocal }   from './stages/09_projectionRowLocal.js';
import { tableDetector }        from './stages/13_tableDetector.js';
import { cellSegmentation }     from './stages/14_cellSegmentation.js';
import { regionCropper }        from './stages/15_regionCropper.js';
import { transformerOCR }       from './stages/16_transformerOCR.js';

import { RegionOverlay }        from './ui/regionOverlay.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const runBtn        = document.getElementById('run-btn');
const mainCanvas    = document.getElementById('main-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const pipelineLog   = document.getElementById('pipeline-log');
const jsonOutput    = document.getElementById('json-output');
const tablePreview  = document.getElementById('table-preview');
const adapterInfo   = document.getElementById('adapter-info');
const statsBar      = document.getElementById('stats-bar');
const copyBtn       = document.getElementById('copy-btn');
const toast         = document.getElementById('toast');

// ── Config sliders ─────────────────────────────────────────────────────────
const cfgSliders = {
  'cfg-thresh': { key: 'THRESH_WINDOW',    display: 'thresh-val', parse: parseInt },
  'cfg-bias':   { key: 'THRESH_BIAS',      display: 'bias-val',   parse: parseFloat },
  'cfg-minr':   { key: 'CIRCLE_MIN_R',     display: 'minr-val',   parse: parseInt },
  'cfg-maxr':   { key: 'CIRCLE_MAX_R',     display: 'maxr-val',   parse: parseInt },
  'cfg-gap':    { key: 'LINE_MERGE_GAP',   display: 'gap-val',    parse: parseInt },
  'cfg-cols':   { key: 'TABLE_MIN_COLS',   display: 'cols-val',   parse: parseInt },
  'cfg-morph':  { key: 'MORPH_KERNEL',     display: 'morph-val',  parse: parseInt },
};

for (const [id, opts] of Object.entries(cfgSliders)) {
  const el = document.getElementById(id);
  const disp = document.getElementById(opts.display);
  const update = () => {
    const v = opts.parse(el.value);
    Config[opts.key] = v;
    disp.textContent = v;
  };
  el.addEventListener('input', update);
  update();
}

// ── Pipeline log ──────────────────────────────────────────────────────────────
const STAGES = [
  'Upload',  'Grayscale', 'Adaptive Threshold',
  'JFA Init', 'JFA Jump (passes)', 'SDF + Local Max',
  'Morph H', 'Morph V',
  'Row Projection', 'Col Projection',
  'Table Detect', 'Cell Segment', 'Region Crop', 'OCR',
];

let logEntries = {};

function buildLog() {
  pipelineLog.innerHTML = '';
  logEntries = {};
  for (const s of STAGES) {
    const el = document.createElement('div');
    el.className = 'log-entry';
    el.innerHTML = `<div class="dot"></div><span>${s}</span><span class="ms"></span>`;
    pipelineLog.appendChild(el);
    logEntries[s] = el;
  }
}

function logActive(stage) {
  const el = logEntries[stage];
  if (!el) return;
  Object.values(logEntries).forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  el.scrollIntoView({ block: 'nearest' });
}

function logDone(stage, ms) {
  const el = logEntries[stage];
  if (!el) return;
  el.classList.remove('active');
  el.classList.add('done');
  el.querySelector('.ms').textContent = ms >= 1 ? `${ms.toFixed(1)}ms` : `<1ms`;
}

function logError(stage) {
  const el = logEntries[stage];
  if (el) { el.classList.remove('active'); el.classList.add('error'); }
}

// ── GPU init ──────────────────────────────────────────────────────────────────
let gpu, texMgr, bufMgr, pipelineCache, profiler, tracker, overlay;

async function initGPU() {
  gpu           = new GPUContext();
  await gpu.init();
  texMgr        = new TextureManager(gpu);
  bufMgr        = new BufferManager(gpu.device);
  pipelineCache = new PipelineCache(gpu.device);
  profiler      = new Profiler(gpu);
  tracker       = new ResourceTracker();

  adapterInfo.textContent = await gpu.adapterInfo();
  return true;
}

// ── Image handling ────────────────────────────────────────────────────────────
let currentBitmap = null;
let currentView   = 'original';
let stageTextures = {};

async function loadImage(file) {
  const bmp = await createImageBitmap(file);
  currentBitmap = bmp;

  // Show on canvas
  mainCanvas.width  = bmp.width;
  mainCanvas.height = bmp.height;
  const ctx2d = mainCanvas.getContext('2d');
  ctx2d.drawImage(bmp, 0, 0);

  // Init overlay
  overlay = new RegionOverlay(overlayCanvas, bmp.width, bmp.height);
  syncOverlaySize();

  runBtn.disabled = false;
}

function syncOverlaySize() {
  const rect = mainCanvas.getBoundingClientRect();
  overlay.syncSize(rect.width, rect.height);
  overlayCanvas.style.width  = rect.width  + 'px';
  overlayCanvas.style.height = rect.height + 'px';
}

// ── View tabs ────────────────────────────────────────────────────────────────
document.querySelectorAll('.view-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    showView(currentView);
  });
});

async function showView(view) {
  const ctx2d = mainCanvas.getContext('2d');
  if (!currentBitmap) return;

  // Clear overlay
  overlay?.clear();

  switch (view) {
    case 'original':
      mainCanvas.width = currentBitmap.width;
      mainCanvas.height = currentBitmap.height;
      ctx2d.drawImage(currentBitmap, 0, 0);
      break;
    case 'gray':
      if (stageTextures.grayTex) {
        await texMgr.previewOnCanvas(stageTextures.grayTex, stageTextures.width, stageTextures.height, mainCanvas, 'r32float');
      }
      break;
    case 'thresh':
      if (stageTextures.binaryTex) {
        await texMgr.previewOnCanvas(stageTextures.binaryTex, stageTextures.width, stageTextures.height, mainCanvas, 'r32float');
      }
      break;
    case 'sdf':
      if (stageTextures.sdfTex) {
        // Normalise SDF for display
        const sdfData = await texMgr.readbackF32(stageTextures.sdfTex, stageTextures.width, stageTextures.height);
        const maxSDF  = Math.max(...sdfData);
        const norm    = new Float32Array(sdfData.length);
        for (let i = 0; i < sdfData.length; i++) norm[i] = sdfData[i] / maxSDF;
        const rgba    = new Uint8ClampedArray(norm.length * 4);
        // False-colour: dark purple → cyan → white
        for (let i = 0; i < norm.length; i++) {
          const v = norm[i];
          rgba[i * 4]     = Math.round(v * 0   + (1 - v) * 50);
          rgba[i * 4 + 1] = Math.round(v * 229 + (1 - v) * 0);
          rgba[i * 4 + 2] = Math.round(v * 255 + (1 - v) * 80);
          rgba[i * 4 + 3] = 255;
        }
        mainCanvas.width  = stageTextures.width;
        mainCanvas.height = stageTextures.height;
        ctx2d.putImageData(new ImageData(rgba, stageTextures.width, stageTextures.height), 0, 0);
      }
      break;
    case 'circles':
      if (stageTextures.grayTex) {
        await texMgr.previewOnCanvas(stageTextures.grayTex, stageTextures.width, stageTextures.height, mainCanvas, 'r32float');
      } else {
        ctx2d.drawImage(currentBitmap, 0, 0);
      }
      syncOverlaySize();
      overlay?.setView('circles');
      break;
    case 'lines':
      ctx2d.drawImage(currentBitmap, 0, 0);
      syncOverlaySize();
      overlay?.setView('lines');
      break;
    case 'table':
      ctx2d.drawImage(currentBitmap, 0, 0);
      syncOverlaySize();
      overlay?.setView('table');
      break;
  }
}

// ── Extract circles from maxima texture ──────────────────────────────────────
async function extractCircles(maximaTex, width, height, minR, maxR) {
  const maxData = await texMgr.readbackF32(maximaTex, width, height);
  const circles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = maxData[y * width + x];
      if (r >= minR && r <= maxR) {
        circles.push({ x, y, r });
      }
    }
  }
  // Non-maximum suppression (greedy)
  circles.sort((a, b) => b.r - a.r);
  const kept = [];
  const used = new Uint8Array(width * height);
  for (const c of circles) {
    if (used[c.y * width + c.x]) continue;
    kept.push(c);
    // Suppress within radius
    const r2 = c.r * c.r * Config.CIRCLE_SUPPRESSION;
    const ri  = Math.ceil(c.r);
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const nx = c.x + dx, ny = c.y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            used[ny * width + nx] = 1;
          }
        }
      }
    }
  }
  return kept;
}

// ── Circle → text-line grouping ───────────────────────────────────────────────
function groupCirclesIntoLines(circles, mergedRows) {
  // Associate circles with their nearest text row
  return mergedRows.map((row, i) => {
    const rowCircles = circles.filter(c => c.y >= row.y0 && c.y <= row.y1);
    return {
      lineIdx: i,
      y:       row.y0,
      h:       row.y1 - row.y0,
      circles: rowCircles,
    };
  });
}

// ── Stats update ──────────────────────────────────────────────────────────────
function updateStats({ circles, lines, cells, totalMs }) {
  statsBar.style.display = 'flex';
  document.getElementById('s-gpu').textContent    = adapterInfo.textContent;
  document.getElementById('s-circles').textContent = circles;
  document.getElementById('s-lines').textContent   = lines;
  document.getElementById('s-cells').textContent   = cells;
  document.getElementById('s-total').textContent   = `${totalMs.toFixed(0)}ms`;
}

// ── JSON output ───────────────────────────────────────────────────────────────
let _lastJSON = null;

function renderJSON(data) {
  _lastJSON = JSON.stringify(data, null, 2);
  const html = _lastJSON
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span class="j-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="j-str">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="j-num">$1</span>')
    .replace(/: (true|false)/g, ': <span class="j-bool">$1</span>')
    .replace(/: null/g, ': <span class="j-null">null</span>');
  jsonOutput.innerHTML = html;
}

function renderTable(tables) {
  if (!tables || tables.length === 0) {
    tablePreview.innerHTML = '';
    return;
  }
  const table = tables[0];
  if (!table || !table.headers || table.headers.length === 0) return;

  let html = '<table class="inv-table"><thead><tr>';
  for (const h of table.headers) html += `<th>${escape(h)}</th>`;
  html += '</tr></thead><tbody>';
  for (const row of (table.rows || [])) {
    html += '<tr>';
    for (const cell of row) html += `<td>${escape(cell)}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  tablePreview.innerHTML = html;
}

function escape(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
async function runPipeline() {
  if (!currentBitmap) return;

  runBtn.disabled = true;
  buildLog();
  const t0 = performance.now();

  // Destroy any previous GPU resources
  tracker.destroyAll();
  bufMgr.destroyAll();
  stageTextures = {};

  // Build pipeline context
  const pctx = {
    gpu, texMgr, bufMgr, pipelineCache, profiler, tracker,
    config:      Config,
    imageBitmap: currentBitmap,
  };

  try {
    // ── 1: Upload ────────────────────────────────────────────────────────
    logActive('Upload');
    let t = performance.now();
    const uploaded = await uploadTexture(pctx);
    Object.assign(pctx, uploaded);
    stageTextures = { ...pctx };
    logDone('Upload', performance.now() - t);

    // ── 2: Grayscale ─────────────────────────────────────────────────────
    logActive('Grayscale');
    t = performance.now();
    Object.assign(pctx, await sobelEdgeDetection(pctx));
    stageTextures.grayTex   = pctx.grayTex;
    stageTextures.width     = pctx.width;
    stageTextures.height    = pctx.height;
    logDone('Grayscale', performance.now() - t);

    // ── 3: Adaptive Threshold ────────────────────────────────────────────
    logActive('Adaptive Threshold');
    t = performance.now();
    Object.assign(pctx, await adaptiveThreshold(pctx));
    stageTextures.binaryTex = pctx.binaryTex;
    logDone('Adaptive Threshold', performance.now() - t);

    // ── 4: JFA Init ──────────────────────────────────────────────────────
    logActive('JFA Init');
    t = performance.now();
    Object.assign(pctx, await jfaInit(pctx));
    logDone('JFA Init', performance.now() - t);

    // ── 5: JFA Jump ──────────────────────────────────────────────────────
    logActive('JFA Jump (passes)');
    t = performance.now();
    Object.assign(pctx, await jfaJumpPass(pctx));
    logDone('JFA Jump (passes)', performance.now() - t);

    // ── 6: SDF + Local Max ───────────────────────────────────────────────
    logActive('SDF + Local Max');
    t = performance.now();
    Object.assign(pctx, await sdfLocalMax(pctx));
    stageTextures.sdfTex    = pctx.sdfTex;
    stageTextures.maximaTex = pctx.maximaTex;
    logDone('SDF + Local Max', performance.now() - t);

    // ── 7-8: Morphology ──────────────────────────────────────────────────
    logActive('Morph H');
    t = performance.now();
    Object.assign(pctx, await morphologyHorizontal(pctx));
    logDone('Morph H', performance.now() - t);

    logActive('Morph V');
    t = performance.now();
    Object.assign(pctx, await morphologyVertical(pctx));
    logDone('Morph V', performance.now() - t);

    // ── 9-10: Projections ────────────────────────────────────────────────
    logActive('Row Projection');
    t = performance.now();
    Object.assign(pctx, await projectionRowLocal(pctx));
    logDone('Row Projection', performance.now() - t);

    // Col projection (reuse helper from stage 09)
    logActive('Col Projection');
    t = performance.now();
    const { projectionColLocal } = await import('./stages/09_projectionRowLocal.js');
    Object.assign(pctx, await projectionColLocal(pctx));
    logDone('Col Projection', performance.now() - t);

    // ── 11: Table Detection ──────────────────────────────────────────────
    logActive('Table Detect');
    t = performance.now();
    Object.assign(pctx, await tableDetector(pctx));
    logDone('Table Detect', performance.now() - t);

    // ── Extract circles from maxima texture (CPU readback) ───────────────
    const circles = await extractCircles(
      pctx.maximaTex, pctx.width, pctx.height,
      Config.CIRCLE_MIN_R, Config.CIRCLE_MAX_R
    );

    // ── Group circles into text line bands ───────────────────────────────
    const lineBlocks = groupCirclesIntoLines(circles, pctx.mergedRows);

    // Set overlay data
    overlay.setCircles(circles);
    overlay.setTextLines(pctx.mergedRows.map((r, i) => ({ lineIdx: i, y: r.y0, h: r.y1 - r.y0 })));
    overlay.setLineBlocks(lineBlocks.map(lb => ({ y: lb.y, h: lb.h })));
    overlay.setTables(pctx.tables);

    // ── 12: Cell Segmentation ────────────────────────────────────────────
    logActive('Cell Segment');
    t = performance.now();
    Object.assign(pctx, await cellSegmentation(pctx));
    overlay.setCells(pctx.cells);
    logDone('Cell Segment', performance.now() - t);

    // ── 13: Region Cropping ──────────────────────────────────────────────
    logActive('Region Crop');
    t = performance.now();
    Object.assign(pctx, await regionCropper(pctx));
    logDone('Region Crop', performance.now() - t);

    //// ── 14: OCR ──────────────────────────────────────────────────────────
    //logActive('OCR');
    //t = performance.now();
    //let ocrTotal = pctx.croppedCells.length + pctx.croppedLines.length;
    //let ocrDone  = 0;

    //pctx.onOCRProgress = (done, total) => {
    //  ocrDone = done;
    //  logEntries['OCR'].querySelector('span:last-child').textContent =
    //    `${Math.round((done / total) * 100)}%`;
    //};

    //Object.assign(pctx, await transformerOCR(pctx));
    //logDone('OCR', performance.now() - t);

    // ── Render output ─────────────────────────────────────────────────────
    const totalMs = performance.now() - t0;
    updateStats({
      circles: circles.length,
      lines:   pctx.mergedRows.length,
      cells:   pctx.cells.length,
      totalMs,
    });

    renderJSON(pctx.invoiceData);
    renderTable(pctx.invoiceData?.tables);

    // Update overlays
    overlay.setTextLines(lineBlocks.map(lb => ({ y: lb.y, h: lb.h })));
    overlay.setCells(pctx.recognisedCells);

    // Switch to circles view
    await showView('circles');
    document.querySelector('[data-view="circles"]').click();

    console.info(`[Pipeline] Complete in ${totalMs.toFixed(0)}ms`);

  } catch (err) {
    console.error('[Pipeline] Error:', err);
    const activeEntry = Object.values(logEntries).find(e => e.classList.contains('active'));
    if (activeEntry) activeEntry.classList.replace('active', 'error');
    jsonOutput.innerHTML = `<span style="color:var(--error)">${err.message}</span>`;
  } finally {
    runBtn.disabled = false;
  }
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file?.type.startsWith('image/')) await loadImage(file);
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) await loadImage(file);
});

runBtn.addEventListener('click', runPipeline);

// ── Copy JSON ─────────────────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!_lastJSON) return;
  await navigator.clipboard.writeText(_lastJSON);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
});

// ── Resize handling ───────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (overlay) syncOverlaySize();
});

// ── Bootstrap ────────────────────────────────────────────────────────────────
(async () => {
  try {
    await initGPU();
    buildLog();
    console.info('[InvoiceEngine] GPU ready. Drop an invoice image to begin.');
  } catch (err) {
    adapterInfo.textContent = 'WebGPU unavailable';
    document.getElementById('gpu-badge').textContent = '⚠ No WebGPU';
    document.getElementById('gpu-badge').style.color = 'var(--error)';
    runBtn.disabled = true;
    jsonOutput.innerHTML = `<span style="color:var(--error)">WebGPU not supported.\n${err.message}\n\nUse Chrome 113+ or Edge 113+.</span>`;
    console.error('[InvoiceEngine] Init failed:', err);
  }
})();
