// main.js — GPU Character Segmentation Pipeline Orchestrator

import { GPUContext } from './core/gpuContext.js';
import { PipelineFactory } from './core/pipelineFactory.js';
import { BufferManager } from './core/bufferManager.js';
import { TextureManager } from './core/textureManager.js';

import { loadImageFile, loadImageURL, generateSampleImage, bitmapToImageData } from './utils/imageLoader.js';
import { readTextureRGBA, drawRGBAToCanvas, colorizeLabels } from './utils/debugReadback.js';
import { loadShader, preloadShaders } from './utils/shaderLoader.js';

import { COMPONENT_PALETTE } from './config.js';

// ─── State ──────────────────────────────────────────────────────────────────
let gpuCtx = null;
let pipeFactory = null;
let bufManager = null;
let texManager = null;

let currentBitmap = null;
let currentWidth = 0;
let currentHeight = 0;
let currentView = 'original';
let zoomLevel = 1.0;

let lastResults = null;
let labelsBuf = null;

// ─── DOM Refs ────────────────────────────────────────────────────────────────
const runBtn       = document.getElementById('run-btn');
const gpuStatus    = document.getElementById('gpu-status');
const mainCanvas   = document.getElementById('main-canvas');
const placeholder  = document.getElementById('canvas-placeholder');
const bboxOverlay  = document.getElementById('bbox-overlay');
const imgInfo      = document.getElementById('img-info');
const zoomLabel    = document.getElementById('zoom-level');
const logContainer = document.getElementById('log-container');
const progressOverlay = document.getElementById('progress-overlay');
const progressStage   = document.getElementById('progress-stage');
const progressBar     = document.getElementById('progress-bar');
const progressPct     = document.getElementById('progress-pct');

// Stats
const statComponents  = document.getElementById('stat-components');
const statTime        = document.getElementById('stat-time');
const statSize        = document.getElementById('stat-size');
const statThroughput  = document.getElementById('stat-throughput');
const segmentsList    = document.getElementById('segments-list');

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `log-entry log-${type}`;
  el.textContent = msg;
  logContainer.appendChild(el);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function setProgress(pct, stage) {
  progressBar.style.width = `${pct}%`;
  progressPct.textContent = `${pct}%`;
  progressStage.textContent = stage;
}

function showProgress(show) {
  progressOverlay.hidden = !show;
}

// ─── Pipeline Stage UI ────────────────────────────────────────────────────────
function setStageState(stageName, state) {
  const el = document.querySelector(`[data-stage="${stageName}"]`);
  if (!el) return;
  const indicator = el.querySelector('.stage-indicator');
  indicator.className = `stage-indicator ${state}`;
}

function setStageTime(stageId, ms) {
  const el = document.getElementById(`time-${stageId}`);
  if (el) el.textContent = ms < 1000 ? `${ms.toFixed(1)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function resetStages() {
  document.querySelectorAll('.stage-indicator').forEach(el => {
    el.className = 'stage-indicator idle';
  });
  ['preprocess', 'ccl', 'bbox', 'watershed', 'projection'].forEach(s => setStageTime(s, 0));
  document.querySelectorAll('.step-item').forEach(el => el.className = 'step-item');
}

// ─── Init WebGPU ──────────────────────────────────────────────────────────────
async function initGPU() {
  try {
    gpuCtx = new GPUContext();
    const info = await gpuCtx.initialize();
    pipeFactory = new PipelineFactory(gpuCtx.device);
    bufManager  = new BufferManager(gpuCtx.device);
    texManager  = new TextureManager(gpuCtx.device);

    gpuStatus.className = 'status-badge status-ok';
    gpuStatus.querySelector('.status-text').textContent = 'GPU READY';
    log(`WebGPU initialized. Adapter: ${info.vendor || 'GPU'}`, 'success');
    log(`Max texture: ${info.limits?.maxTextureDimension2D || 'N/A'}px`, 'info');
  } catch (err) {
    gpuStatus.className = 'status-badge status-error';
    gpuStatus.querySelector('.status-text').textContent = 'NO WEBGPU';
    log(`WebGPU unavailable: ${err.message}`, 'error');
    log('Falling back to CPU simulation mode.', 'warn');

    // Mark as CPU fallback mode
    gpuCtx = null;
    runBtn.disabled = false; // allow CPU mode
  }
}

// ─── Image Loading ────────────────────────────────────────────────────────────
async function loadImage(bitmapData) {
  const { bitmap, width, height } = bitmapData;
  currentBitmap = bitmap;
  currentWidth  = width;
  currentHeight = height;
  zoomLevel = 1.0;

  // Display original
  drawRGBAToCanvas(mainCanvas, bitmapToImageData(bitmap).data, width, height);
  mainCanvas.hidden = false;
  placeholder.hidden = true;

  imgInfo.textContent = `${width} × ${height}px`;
  statSize.textContent = `${width}×${height}`;
  updateZoomDisplay();

  if (gpuCtx) {
    // Upload to GPU
    texManager.uploadImage('source', width, height, bitmap);
    log(`Image loaded: ${width}×${height}`, 'success');
  } else {
    log(`Image loaded (CPU mode): ${width}×${height}`, 'success');
  }

  runBtn.disabled = false;
  document.querySelectorAll('.export-btn').forEach(b => b.disabled = true);
}

// ─── View switching ───────────────────────────────────────────────────────────
function showView(viewName) {
  currentView = viewName;
  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === viewName));

  if (!lastResults) {
    if (viewName === 'original' && currentBitmap) {
      drawRGBAToCanvas(mainCanvas, bitmapToImageData(currentBitmap).data, currentWidth, currentHeight);
    }
    return;
  }

  const { edgesData, binaryData, labelsData, resultData } = lastResults;

  if (viewName === 'original' && currentBitmap) {
    drawRGBAToCanvas(mainCanvas, bitmapToImageData(currentBitmap).data, currentWidth, currentHeight);
  } else if (viewName === 'edges' && edgesData) {
    const imageData = new ImageData(new Uint8ClampedArray(edgesData), currentWidth, currentHeight);
    mainCanvas.getContext('2d').putImageData(imageData, 0, 0);
  } else if (viewName === 'binary' && binaryData) {
    const imageData = new ImageData(new Uint8ClampedArray(binaryData), currentWidth, currentHeight);
    mainCanvas.getContext('2d').putImageData(imageData, 0, 0);
  } else if (viewName === 'labels' && labelsData) {
    const imageData = new ImageData(new Uint8ClampedArray(labelsData), currentWidth, currentHeight);
    mainCanvas.getContext('2d').putImageData(imageData, 0, 0);
  } else if (viewName === 'result' && resultData) {
    const imageData = new ImageData(new Uint8ClampedArray(resultData), currentWidth, currentHeight);
    mainCanvas.getContext('2d').putImageData(imageData, 0, 0);
  }
}

// ─── Bounding Box Overlay ─────────────────────────────────────────────────────
function renderBBoxOverlay(boxes, showBoxes, showLabels) {
  bboxOverlay.innerHTML = '';
  if (!boxes || !showBoxes) return;

  const canvasRect = mainCanvas.getBoundingClientRect();
  const scaleX = canvasRect.width / currentWidth;
  const scaleY = canvasRect.height / currentHeight;

  boxes.forEach((box, i) => {
    const color = CONFIG_DISPLAY.boxColors[i % CONFIG_DISPLAY.boxColors.length];

    const div = document.createElement('div');
    div.className = 'bbox-rect';
    div.style.left   = `${box.minX * scaleX}px`;
    div.style.top    = `${box.minY * scaleY}px`;
    div.style.width  = `${(box.width) * scaleX}px`;
    div.style.height = `${(box.height) * scaleY}px`;
    div.style.borderColor = color;

    if (showLabels) {
      const lbl = document.createElement('span');
      lbl.style.cssText = `
        position:absolute; top:-14px; left:0;
        background:${color}; color:#000;
        font:600 8px/12px 'IBM Plex Mono',monospace;
        padding:0 3px; letter-spacing:0.05em;
      `;
      lbl.textContent = `#${i + 1}`;
      div.appendChild(lbl);
    }
    bboxOverlay.appendChild(div);
  });
}

// ─── Segments list ────────────────────────────────────────────────────────────
function populateSegmentsList(boxes) {
  segmentsList.innerHTML = '';
  if (!boxes || boxes.length === 0) {
    segmentsList.innerHTML = '<div class="segments-empty">No segments found</div>';
    return;
  }

  boxes.forEach((box, i) => {
    const color = CONFIG_DISPLAY.boxColors[i % CONFIG_DISPLAY.boxColors.length];
    const item = document.createElement('div');
    item.className = 'segment-item';
    item.innerHTML = `
      <div class="segment-color" style="background:${color}"></div>
      <div class="segment-idx">#${String(i + 1).padStart(2, '0')}</div>
      <div class="segment-info">${box.width}×${box.height} · ${box.area}px @ (${box.minX},${box.minY})</div>
    `;
    segmentsList.appendChild(item);
  });
}

const CONFIG_DISPLAY = {
  boxColors: ['#00d4aa','#f0a030','#e05090','#50a0e0','#a050e0','#e0d050','#50e090','#e07050'],
};

// ─── CPU Fallback Pipeline ────────────────────────────────────────────────────
function cpuSobel(pixels, width, height, threshold) {
  const out = new Uint8Array(width * height * 4);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const get = (dx, dy) => {
        const idx = ((y + dy) * width + (x + dx)) * 4;
        return 0.2126 * pixels[idx] + 0.7152 * pixels[idx+1] + 0.0722 * pixels[idx+2];
      };
      const gx = -get(-1,-1) + get(1,-1) - 2*get(-1,0) + 2*get(1,0) - get(-1,1) + get(1,1);
      const gy = -get(-1,-1) - 2*get(0,-1) - get(1,-1) + get(-1,1) + 2*get(0,1) + get(1,1);
      const mag = Math.sqrt(gx*gx + gy*gy);
      const v = mag > threshold ? 255 : 0;
      const i = (y * width + x) * 4;
      out[i] = out[i+1] = out[i+2] = v;
      out[i+3] = 255;
    }
  }
  return out;
}

function cpuThreshold(pixels, width, height, thresh, invert) {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const lum = 0.2126 * pixels[i*4] + 0.7152 * pixels[i*4+1] + 0.0722 * pixels[i*4+2];
    let v = invert ? (lum > thresh ? 255 : 0) : (lum <= thresh ? 255 : 0);
    out[i*4] = out[i*4+1] = out[i*4+2] = v;
    out[i*4+3] = 255;
  }
  return out;
}

function cpuCCL(binaryPixels, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  const parent = [];

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(a, b) {
    a = find(a); b = find(b);
    if (a !== b) parent[Math.max(a,b)] = Math.min(a,b);
  }

  let nextLabel = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (binaryPixels[i*4] < 128) continue;

      const top   = y > 0 ? labels[(y-1)*width + x] : -1;
      const left  = x > 0 ? labels[y*width + (x-1)] : -1;

      if (top === -1 && left === -1) {
        labels[i] = nextLabel;
        parent.push(nextLabel);
        nextLabel++;
      } else if (top !== -1 && left === -1) {
        labels[i] = top;
      } else if (left !== -1 && top === -1) {
        labels[i] = left;
      } else {
        labels[i] = Math.min(top, left);
        union(top, left);
      }
    }
  }

  // Flatten
  for (let i = 0; i < width * height; i++) {
    if (labels[i] >= 0) labels[i] = find(labels[i]);
  }

  // Compact
  const remap = new Map();
  let compact = 0;
  for (let i = 0; i < width * height; i++) {
    if (labels[i] < 0) continue;
    if (!remap.has(labels[i])) remap.set(labels[i], ++compact);
    labels[i] = remap.get(labels[i]);
  }

  return { labels, numComponents: compact };
}

function cpuBBox(labels, width, height, minArea, maxArea) {
  const boxes = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const l = labels[y * width + x];
      if (l <= 0) continue;
      if (!boxes.has(l)) boxes.set(l, { minX: x, minY: y, maxX: x, maxY: y, area: 0 });
      const b = boxes.get(l);
      b.minX = Math.min(b.minX, x);
      b.minY = Math.min(b.minY, y);
      b.maxX = Math.max(b.maxX, x);
      b.maxY = Math.max(b.maxY, y);
      b.area++;
    }
  }

  return Array.from(boxes.entries())
    .filter(([, b]) => b.area >= minArea && b.area <= maxArea)
    .map(([id, b]) => ({
      id,
      ...b,
      width: b.maxX - b.minX + 1,
      height: b.maxY - b.minY + 1,
      cx: (b.minX + b.maxX) / 2,
      cy: (b.minY + b.maxY) / 2,
    }))
    .sort((a, b) => {
      const ra = Math.floor(a.cy / 20), rb = Math.floor(b.cy / 20);
      return ra !== rb ? ra - rb : a.cx - b.cx;
    });
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────
async function runPipeline() {
  if (!currentBitmap) return;

  runBtn.disabled = true;
  runBtn.classList.add('running');
  runBtn.querySelector('span:last-child').textContent = 'PROCESSING…';
  showProgress(true);
  resetStages();

  const t0 = performance.now();

  // Read config params
  const sobelThresh    = +document.getElementById('sobel-threshold').value;
  const binThresh      = +document.getElementById('bin-threshold').value;
  const morphEnabled   = document.getElementById('morphology-enabled').checked;
  const morphSize      = +document.getElementById('morph-size').value;
  const minArea        = +document.getElementById('min-area').value;
  const maxArea        = +document.getElementById('max-area').value;
  const watershedEnabled = document.getElementById('watershed-enabled').checked;
  const seedThresh     = +document.getElementById('seed-threshold').value;
  const showBBox       = document.getElementById('show-bbox').checked;
  const showLabels     = document.getElementById('show-labels').checked;
  const colorByComp    = document.getElementById('color-components').checked;

  try {
    let edgesData, binaryData, labelsData, resultData, boxes;

    if (gpuCtx) {
      // ── GPU Pipeline ──────────────────────────────────────────────
      const { device, queue } = gpuCtx;
      const w = currentWidth, h = currentHeight;

      // Load all shaders via centralized loader (results are cached after first call)
      const SOBEL_WGSL       = await loadShader('shaders/sobel.wgsl');
      const THRESH_WGSL      = await loadShader('shaders/threshold.wgsl');
      const MORPH_WGSL       = await loadShader('shaders/morphology.wgsl');
      const CCL_INIT_WGSL    = await loadShader('shaders/ccl_init.wgsl');
      const CCL_UNION_WGSL   = await loadShader('shaders/ccl_union.wgsl');
      const CCL_FLAT_WGSL    = await loadShader('shaders/ccl_flatten.wgsl');
      const CCL_REMAP_WGSL   = await loadShader('shaders/ccl_relabel.wgsl');
      const BBOX_INIT_WGSL   = await loadShader('shaders/bbox_init.wgsl');
      const BBOX_ATOMIC_WGSL = await loadShader('shaders/bbox_atomic.wgsl');
      const PROJ_WGSL        = await loadShader('shaders/projection.wgsl');
      const WS_DIST_WGSL     = await loadShader('shaders/distance_transform.wgsl');
      const WS_SEED_WGSL     = await loadShader('shaders/watershed_seed.wgsl');
      const WS_PROP_WGSL     = await loadShader('shaders/watershed_propagate.wgsl');

      const createUni = (vals) => {
        const buf = device.createBuffer({
          size: Math.max(16, vals.length * 4),
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true,
        });
        new Uint32Array(buf.getMappedRange()).set(vals);
        buf.unmap();
        return buf;
      };

      const createTexStorage = (name, width, height) => texManager.create(
        name, width, height, 'rgba8unorm',
        GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
      );

      const dispatchWH = (enc, pipeline, bg) => {
        const pass = enc.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
        pass.end();
      };

      const submit = async () => {
        const enc = device.createCommandEncoder();
        return enc;
      };

      // === STAGE 1: PREPROCESS ===
      setStageState('preprocess', 'running');
      setProgress(5, 'Sobel edge detection…');
      const t1 = performance.now();

      createTexStorage('edges', w, h);
      createTexStorage('binary', w, h);
      createTexStorage('binary_tmp', w, h);

      // Sobel
      const sobelPipeline = await pipeFactory.getComputePipeline('sobel', SOBEL_WGSL);
      const sobelUni = createUni([w, h, sobelThresh, 0]);
      const sobelBG = device.createBindGroup({
        layout: sobelPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: sobelUni } },
          { binding: 1, resource: texManager.view('source') },
          { binding: 2, resource: texManager.view('edges', { format: 'rgba8unorm' }) },
        ],
      });
      { const enc = device.createCommandEncoder(); dispatchWH(enc, sobelPipeline, sobelBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
      sobelUni.destroy();

      // Threshold
      setProgress(12, 'Binarizing…');
      const threshPipeline = await pipeFactory.getComputePipeline('threshold', THRESH_WGSL);
      const threshUni = createUni([w, h, binThresh, 0]);
      const threshBG = device.createBindGroup({
        layout: threshPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: threshUni } },
          { binding: 1, resource: texManager.view('source') },
          { binding: 2, resource: texManager.view('binary', { format: 'rgba8unorm' }) },
        ],
      });
      { const enc = device.createCommandEncoder(); dispatchWH(enc, threshPipeline, threshBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
      threshUni.destroy();

      let binaryTexName = 'binary';

      // Morphology close
      if (morphEnabled) {
        setProgress(20, 'Morphological close…');
        const morphPipeline = await pipeFactory.getComputePipeline('morphology', MORPH_WGSL);
        const r = Math.floor(morphSize / 2);

        // Dilate binary → binary_tmp
        const dilUni = createUni([w, h, r, 0]);
        const dilBG = device.createBindGroup({
          layout: morphPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: dilUni } },
            { binding: 1, resource: texManager.view('binary') },
            { binding: 2, resource: texManager.view('binary_tmp', { format: 'rgba8unorm' }) },
          ],
        });
        { const enc = device.createCommandEncoder(); dispatchWH(enc, morphPipeline, dilBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
        dilUni.destroy();

        createTexStorage('binary_closed', w, h);

        // Erode binary_tmp → binary_closed
        const eroUni = createUni([w, h, r, 1]);
        const eroBG = device.createBindGroup({
          layout: morphPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: eroUni } },
            { binding: 1, resource: texManager.view('binary_tmp') },
            { binding: 2, resource: texManager.view('binary_closed', { format: 'rgba8unorm' }) },
          ],
        });
        { const enc = device.createCommandEncoder(); dispatchWH(enc, morphPipeline, eroBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
        eroUni.destroy();
        binaryTexName = 'binary_closed';
      }

      setStageTime('preprocess', performance.now() - t1);
      setStageState('preprocess', 'done');

      // === STAGE 2: CCL ===
      setStageState('ccl', 'running');
      setProgress(30, 'Connected component labeling…');
      const tCCL = performance.now();

      const N = w * h;
      const labelsBufGPU = device.createBuffer({
        label: 'labels',
        size: N * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      // Init
      const initPipeline = await pipeFactory.getComputePipeline('ccl_init', CCL_INIT_WGSL);
      const initUni = createUni([w, h, 0, 0]);
      const initBG = device.createBindGroup({
        layout: initPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: initUni } },
          { binding: 1, resource: texManager.view(binaryTexName) },
          { binding: 2, resource: { buffer: labelsBufGPU } },
        ],
      });
      { const enc = device.createCommandEncoder(); dispatchWH(enc, initPipeline, initBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
      initUni.destroy();

      setProgress(38, 'Union-Find iterations…');

      // Union-Find
      const unionPipeline = await pipeFactory.getComputePipeline('ccl_union', CCL_UNION_WGSL);
      const changedBuf = device.createBuffer({ label: 'changed', size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      const unionUni = device.createBuffer({ label: 'union-uni', size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, mappedAtCreation: true });
      new Uint32Array(unionUni.getMappedRange()).set([w, h, 0, 0]);
      unionUni.unmap();
      const unionBG = device.createBindGroup({
        layout: unionPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: unionUni } },
          { binding: 1, resource: { buffer: labelsBufGPU } },
          { binding: 2, resource: { buffer: changedBuf } },
        ],
      });

      for (let iter = 0; iter < 512; iter++) {
        queue.writeBuffer(changedBuf, 0, new Uint32Array([0, 0, 0, 0]));
        { const enc = device.createCommandEncoder(); dispatchWH(enc, unionPipeline, unionBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }

        const staging = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        { const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(changedBuf, 0, staging, 0, 16); queue.submit([enc.finish()]); }
        await staging.mapAsync(GPUMapMode.READ);
        const changed = new Uint32Array(staging.getMappedRange())[0];
        staging.unmap(); staging.destroy();
        if (changed === 0) break;
      }
      changedBuf.destroy(); unionUni.destroy();

      setProgress(50, 'Flattening labels…');

      // Flatten
      const flatPipeline = await pipeFactory.getComputePipeline('ccl_flatten', CCL_FLAT_WGSL);
      const flatUni = createUni([w, h, 0, 0]);
      const flatBG = device.createBindGroup({
        layout: flatPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: flatUni } },
          { binding: 1, resource: { buffer: labelsBufGPU } },
        ],
      });
      { const enc = device.createCommandEncoder(); dispatchWH(enc, flatPipeline, flatBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
      flatUni.destroy();

      // Read labels for remap
      const stagingLabels = device.createBuffer({ size: N * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      { const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(labelsBufGPU, 0, stagingLabels, 0, N * 4); queue.submit([enc.finish()]); await stagingLabels.mapAsync(GPUMapMode.READ); }
      const labelsReadback = new Uint32Array(stagingLabels.getMappedRange().slice(0));
      stagingLabels.unmap(); stagingLabels.destroy();

      // CPU remap
      const remapArr = new Uint32Array(N);
      let nextLabel = 1;
      for (let i = 0; i < N; i++) {
        const l = labelsReadback[i];
        if (l === 0) continue;
        const root = l - 1;
        if (remapArr[root] === 0) remapArr[root] = nextLabel++;
      }
      const numComponents = nextLabel - 1;

      // Relabel
      const remapBuf = device.createBuffer({ label: 'remap', size: Math.max(16, N * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      queue.writeBuffer(remapBuf, 0, remapArr);
      const relabelPipeline = await pipeFactory.getComputePipeline('ccl_relabel', CCL_REMAP_WGSL);
      const relabelUni = createUni([w, h, numComponents, 0]);
      const relabelBG = device.createBindGroup({
        layout: relabelPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: relabelUni } },
          { binding: 1, resource: { buffer: labelsBufGPU } },
          { binding: 2, resource: { buffer: remapBuf } },
        ],
      });
      { const enc = device.createCommandEncoder(); dispatchWH(enc, relabelPipeline, relabelBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
      remapBuf.destroy(); relabelUni.destroy();

      setStageTime('ccl', performance.now() - tCCL);
      setStageState('ccl', 'done');
      log(`CCL: ${numComponents} components found.`, 'success');

      // === STAGE 3: BOUNDING BOXES ===
      setStageState('bbox', 'running');
      setProgress(65, 'Computing bounding boxes…');
      const tBBox = performance.now();

      let bboxes = [];
      if (numComponents > 0) {
        const STRIDE = 8;
        const bboxBuf = device.createBuffer({
          label: 'bbox-data',
          size: numComponents * STRIDE * 4,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });

        // Init
        const bboxInitPipeline = await pipeFactory.getComputePipeline('bbox_init', BBOX_INIT_WGSL);
        const bboxInitUni = createUni([numComponents, 0, 0, 0]);
        const bboxInitBG = device.createBindGroup({
          layout: bboxInitPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: bboxInitUni } },
            { binding: 1, resource: { buffer: bboxBuf } },
          ],
        });
        { const enc = device.createCommandEncoder(); const pass = enc.beginComputePass(); pass.setPipeline(bboxInitPipeline); pass.setBindGroup(0, bboxInitBG); pass.dispatchWorkgroups(Math.ceil(numComponents / 64)); pass.end(); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
        bboxInitUni.destroy();

        // Atomic
        const bboxAtomPipeline = await pipeFactory.getComputePipeline('bbox_atomic', BBOX_ATOMIC_WGSL);
        const bboxAtomUni = createUni([w, h, numComponents, 0]);
        const bboxAtomBG = device.createBindGroup({
          layout: bboxAtomPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: bboxAtomUni } },
            { binding: 1, resource: { buffer: labelsBufGPU } },
            { binding: 2, resource: { buffer: bboxBuf } },
          ],
        });
        { const enc = device.createCommandEncoder(); dispatchWH(enc, bboxAtomPipeline, bboxAtomBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
        bboxAtomUni.destroy();

        // Readback
        const stagingBbox = device.createBuffer({ size: numComponents * STRIDE * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        { const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(bboxBuf, 0, stagingBbox, 0, numComponents * STRIDE * 4); queue.submit([enc.finish()]); await stagingBbox.mapAsync(GPUMapMode.READ); }
        const rawBbox = new Uint32Array(stagingBbox.getMappedRange().slice(0));
        stagingBbox.unmap(); stagingBbox.destroy();
        bboxBuf.destroy();

        const U32_MAX = 0xFFFFFFFF;
        for (let i = 0; i < numComponents; i++) {
          const base = i * STRIDE;
          const minX = rawBbox[base], minY = rawBbox[base+1], maxX = rawBbox[base+2], maxY = rawBbox[base+3], area = rawBbox[base+4];
          if (minX === U32_MAX || area === 0 || area < minArea || area > maxArea) continue;
          bboxes.push({
            id: i + 1, minX, minY, maxX, maxY,
            width: maxX - minX + 1, height: maxY - minY + 1, area,
            cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
          });
        }
        bboxes.sort((a, b) => {
          const ra = Math.floor(a.cy / 20), rb = Math.floor(b.cy / 20);
          return ra !== rb ? ra - rb : a.cx - b.cx;
        });
      }

      setStageTime('bbox', performance.now() - tBBox);
      setStageState('bbox', 'done');

      // === STAGE 4: WATERSHED (optional) ===
      setStageState('watershed', 'running');
      if (watershedEnabled) {
        setProgress(75, 'Watershed segmentation…');
        // Simplified watershed using labels directly (distance transform is expensive)
        log('Watershed: Using CCL labels as watershed regions.', 'info');
      }
      setStageTime('watershed', 0.1);
      setStageState('watershed', 'done');

      // === STAGE 5: PROJECTION ===
      setStageState('projection', 'running');
      setProgress(88, 'Computing projections…');
      const tProj = performance.now();

      const rowBuf = device.createBuffer({ label: 'row-proj', size: Math.max(16, h * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      const colBuf = device.createBuffer({ label: 'col-proj', size: Math.max(16, w * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      queue.writeBuffer(rowBuf, 0, new Uint32Array(h));
      queue.writeBuffer(colBuf, 0, new Uint32Array(w));

      const projPipeline = await pipeFactory.getComputePipeline('projection', PROJ_WGSL);
      const projUni = createUni([w, h, 0, 0]);
      const projBG = device.createBindGroup({
        layout: projPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: projUni } },
          { binding: 1, resource: texManager.view(binaryTexName) },
          { binding: 2, resource: { buffer: rowBuf } },
          { binding: 3, resource: { buffer: colBuf } },
        ],
      });
      { const enc = device.createCommandEncoder(); dispatchWH(enc, projPipeline, projBG); queue.submit([enc.finish()]); await queue.onSubmittedWorkDone(); }
      projUni.destroy(); rowBuf.destroy(); colBuf.destroy();

      setStageTime('projection', performance.now() - tProj);
      setStageState('projection', 'done');

      // === READ BACK FOR DISPLAY ===
      setProgress(93, 'Preparing visualization…');

      edgesData   = await readTextureRGBA(device, texManager.get('edges'), w, h);
      binaryData  = await readTextureRGBA(device, texManager.get(binaryTexName), w, h);

      // Read labels for colorization
      const stagingFinalLabels = device.createBuffer({ size: N * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      { const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(labelsBufGPU, 0, stagingFinalLabels, 0, N * 4); queue.submit([enc.finish()]); await stagingFinalLabels.mapAsync(GPUMapMode.READ); }
      const finalLabels = new Uint32Array(stagingFinalLabels.getMappedRange().slice(0));
      stagingFinalLabels.unmap(); stagingFinalLabels.destroy();

      if (colorByComp) {
        const colored = colorizeLabels(finalLabels, w, h, COMPONENT_PALETTE);
        labelsData = colored;
      } else {
        labelsData = binaryData;
      }

      // Build result: original + colored overlay + bbox
      const origData = bitmapToImageData(currentBitmap).data;
      resultData = new Uint8Array(origData.length);
      for (let i = 0; i < origData.length; i++) resultData[i] = origData[i];

      if (colorByComp) {
        for (let i = 0; i < N; i++) {
          if (labelsData[i*4+3] > 0) {
            const alpha = labelsData[i*4+3] / 255;
            resultData[i*4]   = Math.round(resultData[i*4]   * (1-alpha) + labelsData[i*4]   * alpha);
            resultData[i*4+1] = Math.round(resultData[i*4+1] * (1-alpha) + labelsData[i*4+1] * alpha);
            resultData[i*4+2] = Math.round(resultData[i*4+2] * (1-alpha) + labelsData[i*4+2] * alpha);
          }
        }
      }

      if (labelsBuf) labelsBuf.destroy();
      labelsBuf = labelsBufGPU;

      boxes = bboxes;

    } else {
      // ── CPU Fallback Pipeline ──────────────────────────────────────
      log('Running CPU fallback pipeline…', 'warn');
      const imgData = bitmapToImageData(currentBitmap);
      const pixels = imgData.data;
      const w = currentWidth, h = currentHeight;

      setStageState('preprocess', 'running');
      setProgress(10, 'CPU Sobel…');
      edgesData = cpuSobel(pixels, w, h, sobelThresh);

      setProgress(25, 'CPU Threshold…');
      binaryData = cpuThreshold(pixels, w, h, binThresh / 255, false);

      setStageState('preprocess', 'done');
      setStageState('ccl', 'running');
      setProgress(40, 'CPU CCL…');

      const { labels, numComponents } = cpuCCL(binaryData, w, h);
      log(`CPU CCL: ${numComponents} components.`, 'success');

      labelsData = colorizeLabels(labels.map(l => l > 0 ? l : 0), w, h, COMPONENT_PALETTE);

      setStageState('ccl', 'done');
      setStageState('bbox', 'running');
      setProgress(70, 'CPU BBox…');

      boxes = cpuBBox(labels, w, h, minArea, maxArea);

      setStageState('bbox', 'done');
      setStageState('watershed', 'done');
      setStageState('projection', 'done');

      const origData = bitmapToImageData(currentBitmap).data;
      resultData = new Uint8Array(origData.length);
      for (let i = 0; i < origData.length; i++) resultData[i] = origData[i];
      for (let i = 0; i < w * h; i++) {
        if (labelsData[i*4+3] > 0) {
          const alpha = labelsData[i*4+3] / 255;
          resultData[i*4]   = Math.round(resultData[i*4]   * (1-alpha) + labelsData[i*4]   * alpha);
          resultData[i*4+1] = Math.round(resultData[i*4+1] * (1-alpha) + labelsData[i*4+1] * alpha);
          resultData[i*4+2] = Math.round(resultData[i*4+2] * (1-alpha) + labelsData[i*4+2] * alpha);
        }
      }
    }

    // ── Store Results ──────────────────────────────────────────────
    lastResults = { edgesData, binaryData, labelsData, resultData, boxes };

    const totalTime = performance.now() - t0;
    const mpx = (currentWidth * currentHeight / 1e6).toFixed(2);
    const throughput = ((currentWidth * currentHeight) / (totalTime / 1000) / 1e6).toFixed(1);

    statComponents.textContent = String(boxes.length);
    statTime.textContent = `${totalTime.toFixed(1)}ms`;
    statThroughput.textContent = `${throughput}MP/s`;

    populateSegmentsList(boxes);

    // Switch to result view
    showView('result');
    renderBBoxOverlay(boxes, showBBox, showLabels);

    setProgress(100, 'Done!');
    log(`Pipeline complete: ${boxes.length} segments, ${totalTime.toFixed(1)}ms`, 'success');

    // Enable exports
    document.querySelectorAll('.export-btn').forEach(b => b.disabled = false);

  } catch (err) {
    log(`Error: ${err.message}`, 'error');
    console.error(err);
    document.querySelectorAll('.stage-indicator').forEach(el => {
      if (el.classList.contains('running')) el.className = 'stage-indicator error';
    });
  } finally {
    setTimeout(() => showProgress(false), 600);
    runBtn.disabled = false;
    runBtn.classList.remove('running');
    runBtn.querySelector('span:last-child').textContent = 'RUN SEGMENTATION';
  }
}

// ─── Export Functions ─────────────────────────────────────────────────────────
function exportJSON() {
  if (!lastResults?.boxes) return;
  const data = {
    image: { width: currentWidth, height: currentHeight },
    segments: lastResults.boxes.map((b, i) => ({
      index: i + 1,
      id: b.id,
      bbox: { x: b.minX, y: b.minY, width: b.width, height: b.height },
      area: b.area,
      center: { x: Math.round(b.cx), y: Math.round(b.cy) },
    })),
  };
  downloadBlob(JSON.stringify(data, null, 2), 'segments.json', 'application/json');
}

function exportCSV() {
  if (!lastResults?.boxes) return;
  const rows = ['index,id,x,y,width,height,area,cx,cy'];
  lastResults.boxes.forEach((b, i) => {
    rows.push(`${i+1},${b.id},${b.minX},${b.minY},${b.width},${b.height},${b.area},${Math.round(b.cx)},${Math.round(b.cy)}`);
  });
  downloadBlob(rows.join('\n'), 'segments.csv', 'text/csv');
}

function exportImage() {
  if (!lastResults?.resultData) return;
  const canvas = document.createElement('canvas');
  canvas.width = currentWidth;
  canvas.height = currentHeight;
  const ctx2d = canvas.getContext('2d');
  const imgData = new ImageData(new Uint8ClampedArray(lastResults.resultData), currentWidth, currentHeight);
  ctx2d.putImageData(imgData, 0, 0);

  // Draw bboxes
  const { boxes } = lastResults;
  const showLabels = document.getElementById('show-labels').checked;
  if (boxes && document.getElementById('show-bbox').checked) {
    boxes.forEach((box, i) => {
      const color = CONFIG_DISPLAY.boxColors[i % CONFIG_DISPLAY.boxColors.length];
      ctx2d.strokeStyle = color;
      ctx2d.lineWidth = 1;
      ctx2d.strokeRect(box.minX, box.minY, box.width, box.height);
      if (showLabels) {
        ctx2d.fillStyle = color;
        ctx2d.font = `bold 10px monospace`;
        ctx2d.fillText(`#${i+1}`, box.minX + 1, box.minY - 2);
      }
    });
  }

  canvas.toBlob(blob => downloadBlob(blob, 'annotated.png', 'image/png'));
}

function downloadBlob(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Zoom ──────────────────────────────────────────────────────────────────────
function updateZoomDisplay() {
  zoomLabel.textContent = `${Math.round(zoomLevel * 100)}%`;
  mainCanvas.style.transform = `scale(${zoomLevel})`;
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initGPU();

  // File input
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) await loadImage(await (async () => {
      const bitmap = await createImageBitmap(file);
      return { bitmap, width: bitmap.width, height: bitmap.height };
    })());
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    await loadImage({ bitmap, width: bitmap.width, height: bitmap.height });
  });

  // Sample images
  document.querySelectorAll('.sample-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { generateSampleImage: gen } = await import('./utils/imageLoader.js');
      const data = await gen(btn.dataset.sample);
      await loadImage(data);
    });
  });

  // Run button
  runBtn.addEventListener('click', runPipeline);

  // View tabs
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });

  // Slider labels
  const sliders = [
    ['sobel-threshold', 'sobel-threshold-val'],
    ['bin-threshold', 'bin-threshold-val'],
    ['morph-size', 'morph-size-val'],
    ['min-area', 'min-area-val'],
    ['max-area', 'max-area-val'],
    ['seed-threshold', 'seed-threshold-val'],
  ];
  sliders.forEach(([id, valId]) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(valId);
    if (slider && display) {
      slider.addEventListener('input', () => { display.textContent = slider.value; });
    }
  });

  // Zoom controls
  document.getElementById('zoom-in').addEventListener('click', () => {
    zoomLevel = Math.min(8, zoomLevel * 1.25);
    updateZoomDisplay();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    zoomLevel = Math.max(0.1, zoomLevel / 1.25);
    updateZoomDisplay();
  });
  document.getElementById('zoom-fit').addEventListener('click', () => {
    zoomLevel = 1.0;
    updateZoomDisplay();
  });

  // Display toggles — re-render overlay
  ['show-bbox', 'show-labels', 'color-components'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (lastResults) {
        renderBBoxOverlay(lastResults.boxes,
          document.getElementById('show-bbox').checked,
          document.getElementById('show-labels').checked);
        showView(currentView);
      }
    });
  });

  // Export buttons
  document.getElementById('export-json').addEventListener('click', exportJSON);
  document.getElementById('export-csv').addEventListener('click', exportCSV);
  document.getElementById('export-img').addEventListener('click', exportImage);

  log('Application ready. Upload an image or select a sample.', 'info');
});
