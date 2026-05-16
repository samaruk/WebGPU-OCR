// main.js — Invoice Engine orchestrator

import { GPUContext }    from './core/gpuContext.js';
import { BufferManager } from './core/bufferManager.js';
import { PipelineManager } from './core/pipelineManager.js';
import { loadImage, imageToImageData, readTexture } from './core/utils.js';

import { uploadTexture }         from './stages/01_uploadTexture.js';
import { grayscale }             from './stages/02_grayscale.js';
import { adaptiveThreshold }     from './stages/03_adaptiveThreshold.js';
import { jfaInit }               from './stages/04_jfaInit.js';
import { jfaPasses }             from './stages/05_jfaPass.js';
import { distanceFinalize }      from './stages/06_distanceFinalize.js';
import { localMaxCircles }       from './stages/07_localMaxCircles.js';
import { morphologyHorizontal }  from './stages/08_morphologyHorizontal.js';
import { morphologyVertical }    from './stages/09_morphologyVertical.js';
import { projectionRow }         from './stages/10_projectionRow.js';
import { projectionColumn }      from './stages/11_projectionColumn.js';
import { tableDetector }         from './stages/12_tableDetector.js';
import { regionCropper }         from './stages/13_regionCropper.js';
import { transformerOCR }        from './stages/14_transformerOCR.js';

import { drawOverlay } from './ui/tableMarker.js';

// ─── State ────────────────────────────────────────────────────────────────────
let gpuCtx = null, bm = null, pm = null;
let currentImage = null;   // HTMLImageElement
let currentImageData = null;
let results = { circles: [], textLines: [], table: null, ocrLines: [], tableData: null };
let activeView = 'original';
let activeTab  = 'circles';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const fileInput  = document.getElementById('fileInput');
const dropZone   = document.getElementById('dropZone');
const runBtn     = document.getElementById('runBtn');
const resetBtn   = document.getElementById('resetBtn');
const stageList  = document.getElementById('stageList');
const logArea    = document.getElementById('logArea');
const progressFill = document.getElementById('progressFill');
const mainCanvas   = document.getElementById('mainCanvas');
const overlayCanvas= document.getElementById('overlayCanvas');
const canvasWrapper= document.getElementById('canvasWrapper');
const placeholder  = document.getElementById('placeholder');
const toolbar      = document.getElementById('toolbar');
const panelContent = document.getElementById('panelContent');
const noSupport    = document.getElementById('noSupport');

// ─── Stage definitions ────────────────────────────────────────────────────────
const STAGES = [
  { id: 1,  label: 'Upload & Decode Texture' },
  { id: 2,  label: 'Grayscale Conversion' },
  { id: 3,  label: 'Adaptive Threshold' },
  { id: 4,  label: 'JFA Seed Init' },
  { id: 5,  label: 'Jump Flood Passes' },
  { id: 6,  label: 'Distance Field Finalize' },
  { id: 7,  label: 'Local Max Circle Detection' },
  { id: 8,  label: 'Morphology — Horizontal' },
  { id: 9,  label: 'Morphology — Vertical' },
  { id: 10, label: 'Row Projection' },
  { id: 11, label: 'Column Projection' },
  { id: 12, label: 'Table Region Detection' },
  { id: 13, label: 'Region Cropper' },
  { id: 14, label: 'OCR (Tesseract)' },
];

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  setStatus('init');
  renderStageList();

  try {
    gpuCtx = new GPUContext();
    await gpuCtx.init();
    pm = new PipelineManager(gpuCtx);
    log('WebGPU device ready ✓', 'ok');
    log(`Adapter: ${gpuCtx.adapter.info?.description ?? 'unknown'}`, 'info');
    setStatus('ready');
  } catch (e) {
    log('WebGPU init failed: ' + e.message, 'err');
    setStatus('error');
    noSupport.classList.add('show');
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function setStatus(s) {
  statusDot.className = 'dot ' + s;
  statusText.textContent = {
    init: 'Initializing…',
    ready: 'Ready',
    busy: 'Processing…',
    error: 'Error',
  }[s] ?? s;
}

function log(msg, level = 'info') {
  const el = document.createElement('div');
  el.className = `log-line ${level}`;
  el.textContent = msg;
  logArea.appendChild(el);
  logArea.scrollTop = logArea.scrollHeight;
}

function renderStageList() {
  stageList.innerHTML = '';
  for (const s of STAGES) {
    const el = document.createElement('div');
    el.className = 'stage-item';
    el.id = `stage-${s.id}`;
    el.innerHTML = `
      <span class="stage-num">${String(s.id).padStart(2,'0')}</span>
      <div class="stage-icon"></div>
      <span style="flex:1;font-size:10px">${s.label}</span>
      <span class="stage-time"></span>
    `;
    stageList.appendChild(el);
  }
}

function stageState(id, state, ms) {
  const el = document.getElementById(`stage-${id}`);
  if (!el) return;
  el.className = `stage-item ${state}`;
  if (ms != null) el.querySelector('.stage-time').textContent = ms.toFixed(0) + 'ms';
  progressFill.style.width = (id / STAGES.length * 100) + '%';
}

// ─── Image upload ─────────────────────────────────────────────────────────────
async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  log(`Loading: ${file.name}`, 'info');
  const img = await loadImage(file);
  currentImage = img;
  currentImageData = imageToImageData(img, 2048);
  showImage(currentImageData);
  runBtn.disabled = false;
  resetBtn.disabled = false;
  log(`Image: ${currentImageData.width}×${currentImageData.height}px`, 'ok');
}

function showImage(imageData) {
  const { width: iw, height: ih } = imageData;
  const maxW = mainCanvas.parentElement.clientWidth - 24;
  const maxH = window.innerHeight - 120;
  const scale = Math.min(1, maxW / iw, maxH / ih);
  const cw = Math.round(iw * scale), ch = Math.round(ih * scale);

  mainCanvas.width = cw; mainCanvas.height = ch;
  overlayCanvas.width = cw; overlayCanvas.height = ch;

  const ctx = mainCanvas.getContext('2d');
  const tmp = document.createElement('canvas');
  tmp.width = iw; tmp.height = ih;
  tmp.getContext('2d').putImageData(imageData, 0, 0);
  ctx.drawImage(tmp, 0, 0, cw, ch);

  placeholder.style.display = 'none';
  canvasWrapper.style.display = 'block';
  toolbar.style.display = 'flex';
}

// ─── Main pipeline ────────────────────────────────────────────────────────────
async function runPipeline() {
  if (!currentImageData || !gpuCtx) return;
  runBtn.disabled = true;
  setStatus('busy');
  progressFill.style.width = '0%';
  renderStageList();

  // Re-create buffer manager for fresh run
  if (bm) bm.destroy();
  bm = new BufferManager(gpuCtx);

  const { width: iw, height: ih } = currentImageData;
  let t, pingpong, finalIdx;

  try {
    // ── Stage 1: Upload
    stageState(1, 'running');
    t = performance.now();
    await uploadTexture(gpuCtx, bm, currentImageData);
    stageState(1, 'done', performance.now() - t);
    log(`[01] Texture uploaded ${iw}×${ih}`, 'ok');

    // ── Stage 2: Grayscale
    stageState(2, 'running');
    t = performance.now();
    await grayscale(gpuCtx, bm, pm, iw, ih);
    stageState(2, 'done', performance.now() - t);
    log('[02] Grayscale done', 'ok');

    // ── Stage 3: Threshold
    stageState(3, 'running');
    t = performance.now();
    await adaptiveThreshold(gpuCtx, bm, pm, iw, ih);
    stageState(3, 'done', performance.now() - t);
    log('[03] Adaptive threshold done', 'ok');

    // ── Stage 4: JFA Init
    stageState(4, 'running');
    t = performance.now();
    pingpong = await jfaInit(gpuCtx, bm, pm, iw, ih);
    stageState(4, 'done', performance.now() - t);
    log('[04] JFA seeded', 'ok');

    // ── Stage 5: JFA Passes
    stageState(5, 'running');
    t = performance.now();
    const jfaResult = await jfaPasses(gpuCtx, bm, pm, iw, ih, pingpong);
    finalIdx = jfaResult.finalIdx;
    stageState(5, 'done', performance.now() - t);
    log('[05] JFA propagation done', 'ok');

    // ── Stage 6: Distance finalize
    stageState(6, 'running');
    t = performance.now();
    await distanceFinalize(gpuCtx, bm, pm, iw, ih, pingpong, finalIdx);
    stageState(6, 'done', performance.now() - t);
    log('[06] Distance field ready', 'ok');

    // ── Stage 7: Circle detection
    stageState(7, 'running');
    t = performance.now();
    results.circles = await localMaxCircles(gpuCtx, bm, iw, ih);
    stageState(7, 'done', performance.now() - t);
    log(`[07] Detected ${results.circles.length} circles`, 'ok');

    // ── Stage 8: Morph H
    stageState(8, 'running');
    t = performance.now();
    await morphologyHorizontal(gpuCtx, bm, pm, iw, ih);
    stageState(8, 'done', performance.now() - t);
    log('[08] Horizontal dilation done', 'ok');

    // ── Stage 9: Morph V
    stageState(9, 'running');
    t = performance.now();
    await morphologyVertical(gpuCtx, bm, pm, iw, ih);
    stageState(9, 'done', performance.now() - t);
    log('[09] Vertical dilation done', 'ok');

    // ── Stage 10: Row projection
    stageState(10, 'running');
    t = performance.now();
    await projectionRow(gpuCtx, bm, pm, iw, ih);
    stageState(10, 'done', performance.now() - t);
    log('[10] Row projection done', 'ok');

    // ── Stage 11: Col projection
    stageState(11, 'running');
    t = performance.now();
    await projectionColumn(gpuCtx, bm, pm, iw, ih);
    stageState(11, 'done', performance.now() - t);
    log('[11] Column projection done', 'ok');

    // ── Stage 12: Table detection
    stageState(12, 'running');
    t = performance.now();
    const { textLines, table } = await tableDetector(gpuCtx, bm, pm, iw, ih);
    results.textLines = textLines;
    results.table = table;
    stageState(12, 'done', performance.now() - t);
    log(`[12] ${textLines.length} text lines, table: ${table ? 'yes' : 'no'}`, 'ok');

    // ── Stage 13: Region crop
    stageState(13, 'running');
    t = performance.now();
    const regions = await regionCropper(gpuCtx, bm, iw, ih, textLines, table);
    stageState(13, 'done', performance.now() - t);
    log(`[13] Cropped ${regions.length} regions`, 'ok');

    // ── Stage 14: OCR
    stageState(14, 'running');
    t = performance.now();
    const { lines: ocrLines, tableData } = await transformerOCR(
      regions, iw, ih,
      p => log(`[14] OCR ${(p * 100).toFixed(0)}%`, 'info')
    );
    results.ocrLines = ocrLines;
    results.tableData = tableData;
    stageState(14, 'done', performance.now() - t);
    log(`[14] OCR: ${ocrLines.length} lines`, 'ok');

    // ── Update UI
    progressFill.style.width = '100%';
    setStatus('ready');
    runBtn.disabled = false;
    updateView();
    updatePanel(activeTab);

  } catch (e) {
    log('Pipeline error: ' + e.message, 'err');
    console.error(e);
    setStatus('error');
    runBtn.disabled = false;
  }
}

// ─── View rendering ───────────────────────────────────────────────────────────
async function updateView() {
  if (!bm || !currentImageData) return;
  const { width: iw, height: ih } = currentImageData;
  const ctx2d = mainCanvas.getContext('2d');
  const cw = mainCanvas.width, ch = mainCanvas.height;

  const drawRaw = async (texName) => {
    try {
      const tex = bm.getTexture(texName);
      const pixels = await readTexture(gpuCtx.device, tex, iw, ih, 4);
      const id = new ImageData(new Uint8ClampedArray(pixels), iw, ih);
      const tmp = new OffscreenCanvas(iw, ih);
      tmp.getContext('2d').putImageData(id, 0, 0);
      ctx2d.drawImage(tmp, 0, 0, cw, ch);
    } catch (e) {
      // texture not available yet
    }
  };

  if (activeView === 'original') {
    const tmp = document.createElement('canvas');
    tmp.width = iw; tmp.height = ih;
    tmp.getContext('2d').putImageData(currentImageData, 0, 0);
    ctx2d.drawImage(tmp, 0, 0, cw, ch);
  } else if (activeView === 'gray') {
    await drawRaw('gray');
  } else if (activeView === 'threshold') {
    await drawRaw('threshold');
  } else if (activeView === 'distance') {
    // Normalize and draw distance field
    try {
      const tex = bm.getTexture('distance');
      const raw = await readTexture(gpuCtx.device, tex, iw, ih, 4);
      const dist = new Float32Array(raw.buffer);
      let maxD = 0;
      for (let i = 0; i < dist.length; i++) maxD = Math.max(maxD, dist[i]);
      const rgba = new Uint8ClampedArray(iw * ih * 4);
      for (let i = 0; i < dist.length; i++) {
        const v = Math.round((dist[i] / maxD) * 255);
        rgba[i * 4]     = v;
        rgba[i * 4 + 1] = Math.round(v * 0.5);
        rgba[i * 4 + 2] = 255 - v;
        rgba[i * 4 + 3] = 255;
      }
      const id = new ImageData(rgba, iw, ih);
      const tmp = new OffscreenCanvas(iw, ih);
      tmp.getContext('2d').putImageData(id, 0, 0);
      ctx2d.drawImage(tmp, 0, 0, cw, ch);
    } catch (e) {}
  } else {
    // circles, lines, table — show original + overlay
    const tmp = document.createElement('canvas');
    tmp.width = iw; tmp.height = ih;
    tmp.getContext('2d').putImageData(currentImageData, 0, 0);
    ctx2d.drawImage(tmp, 0, 0, cw, ch);
  }

  // Draw overlay for relevant views
  drawOverlay(
    overlayCanvas,
    iw, ih, cw, ch,
    results.circles,
    results.textLines,
    results.table,
    activeView
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function updatePanel(tab) {
  panelContent.innerHTML = '';

  if (tab === 'circles') {
    const statGrid = document.createElement('div');
    statGrid.className = 'stat-grid';
    statGrid.innerHTML = `
      <div class="stat-card"><div class="stat-label">Circles</div><div class="stat-value">${results.circles.length}</div></div>
      <div class="stat-card"><div class="stat-label">Max Radius</div><div class="stat-value">${results.circles[0]?.r.toFixed(0) ?? '—'}px</div></div>
    `;
    panelContent.appendChild(statGrid);

    const legend = document.createElement('div');
    legend.className = 'circle-legend';
    legend.innerHTML = `
      <span class="legend-dot" style="background:rgba(0,229,160,0.5);border:1px solid #00e5a0"></span> Small circles (r &lt; 20px)<br>
      <span class="legend-dot" style="background:rgba(123,92,255,0.5);border:1px solid #7b5cff"></span> Large circles (r ≥ 20px)<br>
      <span class="legend-dot" style="background:rgba(0,229,160,0.3)"></span> Center dot on large circles
    `;
    panelContent.appendChild(legend);

    // Top 20 circles
    const title = document.createElement('div');
    title.style.cssText = 'font-family:Space Mono;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px';
    title.textContent = 'Top circles by radius';
    panelContent.appendChild(title);

    for (const c of results.circles.slice(0, 30)) {
      const el = document.createElement('div');
      el.className = 'text-line-item';
      el.innerHTML = `
        <div class="line-meta">center (${c.x}, ${c.y}) · score ${(c.score * 100).toFixed(1)}%</div>
        <div class="line-text">radius: <strong>${c.r.toFixed(1)}px</strong></div>
      `;
      el.addEventListener('click', () => highlightCircle(c));
      panelContent.appendChild(el);
    }

  } else if (tab === 'lines') {
    const count = results.ocrLines.length || results.textLines.length;
    const statGrid = document.createElement('div');
    statGrid.className = 'stat-grid';
    statGrid.innerHTML = `
      <div class="stat-card"><div class="stat-label">Text Lines</div><div class="stat-value">${count}</div></div>
      <div class="stat-card"><div class="stat-label">With OCR</div><div class="stat-value">${results.ocrLines.length}</div></div>
    `;
    panelContent.appendChild(statGrid);

    if (results.ocrLines.length > 0) {
      for (const line of results.ocrLines) {
        const el = document.createElement('div');
        el.className = 'text-line-item';
        el.innerHTML = `
          <div class="line-meta">y=${line.y} · ${line.w}×${line.h}px</div>
          <div class="line-text">${escHtml(line.text)}</div>
        `;
        panelContent.appendChild(el);
      }
    } else {
      for (const line of results.textLines) {
        const el = document.createElement('div');
        el.className = 'text-line-item';
        el.innerHTML = `
          <div class="line-meta">y=${line.start}–${line.end} · ${line.end - line.start}px tall</div>
          <div class="line-text" style="color:var(--muted)">[OCR not loaded]</div>
        `;
        panelContent.appendChild(el);
      }
    }

  } else if (tab === 'table') {
    if (!results.table && !results.tableData) {
      panelContent.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:40px 0">No table detected</div>';
      return;
    }

    const t = results.table;
    if (t) {
      const statGrid = document.createElement('div');
      statGrid.className = 'stat-grid';
      statGrid.innerHTML = `
        <div class="stat-card"><div class="stat-label">Rows</div><div class="stat-value">${t.rows}</div></div>
        <div class="stat-card"><div class="stat-label">Columns</div><div class="stat-value">${t.cols}</div></div>
        <div class="stat-card"><div class="stat-label">X</div><div class="stat-value">${t.x}px</div></div>
        <div class="stat-card"><div class="stat-label">Y</div><div class="stat-value">${t.y}px</div></div>
      `;
      panelContent.appendChild(statGrid);
    }

    if (results.tableData) {
      const { header, rows } = results.tableData;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      const tbl = document.createElement('table');
      tbl.className = 'invoice-table';

      if (header.length > 0) {
        const thead = tbl.createTHead();
        const tr = thead.insertRow();
        for (const h of header) { const th = document.createElement('th'); th.textContent = h; tr.appendChild(th); }
      }

      const tbody = tbl.createTBody();
      for (const row of rows) {
        const tr = tbody.insertRow();
        for (const cell of row) { tr.insertCell().textContent = cell; }
      }

      wrapper.appendChild(tbl);
      panelContent.appendChild(wrapper);
    }

  } else if (tab === 'stats') {
    const perf = document.createElement('div');
    perf.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Image Size</div><div class="stat-value" style="font-size:13px">${currentImageData?.width ?? '—'}×${currentImageData?.height ?? '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Circles</div><div class="stat-value">${results.circles.length}</div></div>
        <div class="stat-card"><div class="stat-label">Text Lines</div><div class="stat-value">${results.textLines.length}</div></div>
        <div class="stat-card"><div class="stat-label">Table Rows</div><div class="stat-value">${results.table?.rows ?? '—'}</div></div>
      </div>
      <div class="circle-legend" style="margin-top:8px">
        <strong style="color:var(--accent)">Pipeline:</strong> JFA-based Euclidean Distance Transform → Local Maxima → Inscribed Circles<br><br>
        <strong style="color:var(--accent)">Text Lines:</strong> Adaptive Threshold → Morphology → Horizontal Projection<br><br>
        <strong style="color:var(--accent)">Table:</strong> Row + Column Projection → Band Detection → Region Clustering
      </div>
    `;
    panelContent.appendChild(perf);
  }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function highlightCircle(c) {
  const ctx = overlayCanvas.getContext('2d');
  const iw = currentImageData.width, ih = currentImageData.height;
  const sx = mainCanvas.width / iw, sy = mainCanvas.height / ih;
  // Flash highlight
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(c.x * sx, c.y * sy, c.r * Math.min(sx, sy), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  setTimeout(() => updateView(), 600);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});

runBtn.addEventListener('click', runPipeline);
resetBtn.addEventListener('click', () => {
  results = { circles: [], textLines: [], table: null, ocrLines: [], tableData: null };
  if (bm) { bm.destroy(); bm = new BufferManager(gpuCtx); }
  renderStageList();
  progressFill.style.width = '0%';
  logArea.innerHTML = '';
  panelContent.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:40px 0">Run the pipeline to see results</div>';
  if (currentImageData) showImage(currentImageData);
  overlayCanvas.getContext('2d').clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
});

// View buttons
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeView = btn.dataset.view;
    updateView();
  });
});

// Panel tabs
document.querySelectorAll('.panel-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    updatePanel(activeTab);
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
