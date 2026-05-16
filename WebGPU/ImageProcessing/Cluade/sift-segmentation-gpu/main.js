/**
 * main.js – application entry-point.
 * Wires the UI to the GPU pipeline, handles image I/O and export.
 */
import { GPUContext }         from './core/gpuContext.js';
import { PreprocessPipeline } from './preprocessing/preprocessPipeline.js';
import { GaussianPyramid }    from './pyramid/gaussianPyramid.js';
import { SIFTDetector }       from './sift/extremaDetection.js';
import { DescriptorExtractor }from './sift/descriptorExtract.js';
import { KeypointGridCluster }from './clustering/keypointGridCluster.js';
import { AdaptiveMaskFusion } from './segmentation/adaptiveMaskFusion.js';
import { CCAPipeline }        from './segmentation/cca/localLabelPass.js';
import { GraphBuilder }       from './graph/graphBuilder.js';
import { DeterministicMerge } from './graph/deterministicMerge.js';
import { BoundingBoxExtract } from './postprocess/boundingBoxExtract.js';
import { PolygonFit }         from './postprocess/polygonFit.js';
import { OutputFormatter }    from './postprocess/outputFormatter.js';
import { Profiler }           from './utils/profiler.js';
import { Logger }             from './utils/logger.js';
import { mergeConfig, readUIConfig, DEFAULT_CONFIG } from './config.js';

// ── Global state ────────────────────────────────────────────────────────────
let gpuCtx    = null;
let lastResult = null;
let imageBitmap = null;

const logger   = new Logger(document.getElementById('log-output'));
const profiler = new Profiler();

// ── UI helpers ───────────────────────────────────────────────────────────────
function setProgress(pct, label) {
  const bar  = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  const lbl  = document.getElementById('progress-label');
  if (pct == null) { bar.hidden = true; return; }
  bar.hidden = false;
  fill.style.setProperty('--pct', pct + '%');
  lbl.textContent = label ?? 'Processing…';
}

function setStatus(text, cls = '') {
  const el = document.getElementById('gpu-status');
  el.textContent = text;
  el.className = 'status-badge ' + cls;
}

function updateStats(kp, seg, ms) {
  document.getElementById('stat-keypoints').textContent = `${kp ?? '—'} kp`;
  document.getElementById('stat-segments').textContent  = `${seg ?? '—'} seg`;
  document.getElementById('stat-time').textContent      = ms != null ? `${ms.toFixed(0)} ms` : '—';
}

function bindSlider(id, outId, fmt) {
  const el  = document.getElementById(id);
  const out = document.getElementById(outId);
  if (!el || !out) return;
  const update = () => { out.value = fmt ? fmt(el.value) : el.value; };
  el.addEventListener('input', update);
  update();
}

// ── Tab switching ────────────────────────────────────────────────────────────
function initTabs() {
  const btns = document.querySelectorAll('.nav-btn[data-tab]');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `panel-${tab}`);
      });
    });
  });
}

// ── Image loading ────────────────────────────────────────────────────────────
async function loadImageFile(file) {
  if (!file.type.startsWith('image/')) { logger.warn('Not an image file'); return; }
  const bitmap = await createImageBitmap(file);
  imageBitmap = bitmap;

  const preview = document.getElementById('preview-canvas');
  const scale   = Math.min(212 / bitmap.width, 120 / bitmap.height, 1);
  preview.width  = Math.round(bitmap.width  * scale);
  preview.height = Math.round(bitmap.height * scale);
  preview.getContext('2d').drawImage(bitmap, 0, 0, preview.width, preview.height);
  preview.hidden = false;
  document.getElementById('drop-zone').hidden = true;

  document.getElementById('run-btn').disabled = false;
  document.getElementById('canvas-overlay').style.display = 'none';
  logger.info(`Loaded ${file.name} (${bitmap.width}×${bitmap.height})`);
}

// ── Main pipeline ────────────────────────────────────────────────────────────
async function runPipeline() {
  if (!imageBitmap || !gpuCtx) return;
  const runBtn = document.getElementById('run-btn');
  runBtn.disabled = true;
  profiler.reset();

  try {
    const cfg = mergeConfig(readUIConfig());
    logger.info('Pipeline start');
    setProgress(0, 'Uploading texture…');

    // 1 – Upload to GPU
    profiler.mark('upload');
    const inputTex = gpuCtx.textureManager.fromBitmap(imageBitmap);
    const W = imageBitmap.width, H = imageBitmap.height;
    profiler.measure('upload');
    setProgress(8, 'Preprocessing…');

    // 2 – Preprocessing
    profiler.mark('preprocess');
    const preproc = new PreprocessPipeline(gpuCtx, cfg.preprocessing);
    const grayTex = await preproc.run(inputTex, W, H);
    profiler.measure('preprocess');
    setProgress(18, 'Building Gaussian pyramid…');

    // 3 – Gaussian pyramid
    profiler.mark('pyramid');
    const pyramid = new GaussianPyramid(gpuCtx, cfg.pyramid);
    const pyrResult = await pyramid.build(grayTex, W, H);
    profiler.measure('pyramid');
    renderPyramid(pyrResult);
    setProgress(32, 'Detecting extrema…');

    // 4 – SIFT keypoints
    profiler.mark('sift');
    const detector = new SIFTDetector(gpuCtx, cfg.sift);
    const rawKps   = await detector.detect(pyrResult);
    profiler.measure('sift');
    logger.info(`Detected ${rawKps.length} raw keypoints`);
    setProgress(48, 'Extracting descriptors…');

    // 5 – Descriptors
    profiler.mark('desc');
    const descExtractor = new DescriptorExtractor(gpuCtx, cfg.sift);
    const keypoints = await descExtractor.extract(pyrResult, rawKps);
    profiler.measure('desc');
    setProgress(56, 'Clustering keypoints…');

    // 6 – Cluster / filter
    profiler.mark('cluster');
    const clusterer = new KeypointGridCluster(cfg.clustering);
    const clusteredKps = clusterer.cluster(keypoints, W, H);
    profiler.measure('cluster');
    logger.info(`${clusteredKps.length} keypoints after clustering`);
    renderKeypoints(clusteredKps, W, H);
    setProgress(64, 'Adaptive mask fusion…');

    // 7 – Mask fusion
    profiler.mark('mask');
    const maskFusion = new AdaptiveMaskFusion(gpuCtx, cfg.segmentation);
    const maskTex    = await maskFusion.run(grayTex, clusteredKps, W, H);
    profiler.measure('mask');
    setProgress(72, 'Connected component analysis…');

    // 8 – CCA
    profiler.mark('cca');
    const cca       = new CCAPipeline(gpuCtx);
    const ccaResult = await cca.run(maskTex, W, H);
    profiler.measure('cca');
    setProgress(82, 'Building adjacency graph…');

    // 9 – Graph build + merge
    profiler.mark('graph');
    const graphBuilder = new GraphBuilder(cfg.graph);
    const graph        = graphBuilder.build(ccaResult, clusteredKps);
    const merger       = new DeterministicMerge(cfg.graph);
    const mergedGraph  = merger.merge(graph, cfg.segmentation.mergeThreshold);
    profiler.measure('graph');
    renderGraph(mergedGraph, W, H);
    setProgress(90, 'Extracting polygons…');

    // 10 – Post-process
    profiler.mark('post');
    const bboxes   = BoundingBoxExtract.extract(mergedGraph);
    const polygons = PolygonFit.fit(mergedGraph, cfg.postprocess);
    const output   = OutputFormatter.format(mergedGraph, bboxes, polygons, W, H);
    profiler.measure('post');
    setProgress(96, 'Rendering result…');

    // 11 – Final render
    renderSegmentation(output, imageBitmap, W, H);
    buildSegmentList(output.segments);

    const totalMs = profiler.totalMs();
    updateStats(clusteredKps.length, output.segments.length, totalMs);
    logger.success(`Done in ${totalMs.toFixed(0)} ms`);
    lastResult = output;
    setProgress(null);
    setStatus(`GPU · ${W}×${H}`, 'ready');
  } catch (err) {
    logger.error(err.message ?? String(err));
    console.error(err);
    setProgress(null);
    setStatus('Error', 'error');
  } finally {
    runBtn.disabled = false;
  }
}

// ── Render helpers ────────────────────────────────────────────────────────────
function renderSegmentation(output, bitmap, W, H) {
  const canvas = document.getElementById('output-canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const palette = output.segments.map((_, i) =>
    `hsl(${(i * 47 + 30) % 360},70%,55%)`);
  output.segments.forEach((seg, i) => {
    if (!seg.polygon?.length) return;
    ctx.beginPath();
    ctx.moveTo(seg.polygon[0][0], seg.polygon[0][1]);
    seg.polygon.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.strokeStyle = palette[i];
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.fillStyle = palette[i];
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function renderKeypoints(kps, W, H) {
  const canvas = document.getElementById('keypoints-canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (imageBitmap) ctx.drawImage(imageBitmap, 0, 0);
  kps.forEach(kp => {
    const r = Math.max(2, kp.scale * 3);
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    // orientation line
    const dx = r * Math.cos(kp.orientation ?? 0);
    const dy = r * Math.sin(kp.orientation ?? 0);
    ctx.beginPath();
    ctx.moveTo(kp.x, kp.y);
    ctx.lineTo(kp.x + dx, kp.y + dy);
    ctx.strokeStyle = '#7b61ff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function renderPyramid(pyrResult) {
  const grid = document.getElementById('pyramid-grid');
  grid.innerHTML = '';
  pyrResult.octaves.forEach((octave, oi) => {
    octave.scales.forEach((scale, si) => {
      if (!scale.cpuData) return;
      const c = document.createElement('canvas');
      c.width = scale.width; c.height = scale.height;
      c.title = `Oct ${oi}  Sc ${si}`;
      const ctx = c.getContext('2d');
      const id  = ctx.createImageData(scale.width, scale.height);
      for (let i = 0; i < scale.cpuData.length; i++) {
        const v = scale.cpuData[i];
        id.data[i * 4]     = v;
        id.data[i * 4 + 1] = v;
        id.data[i * 4 + 2] = v;
        id.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      const maxDim = 80;
      const sc = Math.min(maxDim / scale.width, maxDim / scale.height, 1);
      c.style.width  = Math.round(scale.width  * sc) + 'px';
      c.style.height = Math.round(scale.height * sc) + 'px';
      grid.appendChild(c);
    });
  });
}

function renderGraph(graph, W, H) {
  const canvas = document.getElementById('graph-canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (imageBitmap) ctx.drawImage(imageBitmap, 0, 0);
  ctx.globalAlpha = 0.5;
  graph.edges.forEach(e => {
    const n1 = graph.nodes[e.a], n2 = graph.nodes[e.b];
    if (!n1 || !n2) return;
    ctx.beginPath();
    ctx.moveTo(n1.cx, n1.cy);
    ctx.lineTo(n2.cx, n2.cy);
    ctx.strokeStyle = `rgba(123,97,255,${Math.min(1, e.score)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  graph.nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.cx, n.cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00d4ff';
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function buildSegmentList(segments) {
  const list = document.getElementById('segment-list');
  list.innerHTML = '';
  segments.forEach((seg, i) => {
    const div   = document.createElement('div');
    div.className = 'segment-item';
    const color = `hsl(${(i * 47 + 30) % 360},70%,55%)`;
    div.innerHTML = `
      <div class="segment-swatch" style="background:${color}"></div>
      <span class="segment-info">Seg ${seg.id}</span>
      <span class="segment-area">${seg.area ?? 0} px²</span>`;
    list.appendChild(div);
  });
}

// ── Export ───────────────────────────────────────────────────────────────────
function exportPNG() {
  if (!lastResult) return;
  const canvas = document.getElementById('output-canvas');
  const a = document.createElement('a');
  a.download = 'segmentation.png';
  a.href = canvas.toDataURL();
  a.click();
}

function exportJSON() {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = 'segmentation.json';
  a.href = URL.createObjectURL(blob);
  a.click();
}

function exportSVG() {
  if (!lastResult) return;
  const { width: W, height: H, segments } = lastResult;
  const paths = segments.map((seg, i) => {
    if (!seg.polygon?.length) return '';
    const color = `hsl(${(i * 47 + 30) % 360},70%,55%)`;
    const d = 'M' + seg.polygon.map(([x, y]) => `${x},${y}`).join('L') + 'Z';
    return `<path d="${d}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1.5"/>`;
  }).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">\n${paths}\n</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.download = 'segmentation.svg';
  a.href = URL.createObjectURL(blob);
  a.click();
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  initTabs();
  bindSlider('gamma',          'gamma-out',          v => (+v).toFixed(2));
  bindSlider('clahe-clip',     'clahe-clip-out',     v => (+v).toFixed(1));
  bindSlider('octaves',        'octaves-out',        v => v);
  bindSlider('scales',         'scales-out',         v => v);
  bindSlider('contrast-thresh','contrast-thresh-out',v => (+v).toFixed(3));
  bindSlider('edge-thresh',    'edge-thresh-out',    v => v);
  bindSlider('min-area',       'min-area-out',       v => v);
  bindSlider('merge-thresh',   'merge-thresh-out',   v => (+v).toFixed(2));

  // Drop zone
  const zone   = document.getElementById('drop-zone');
  const input  = document.getElementById('file-input');
  const browse = document.getElementById('browse-btn');
  browse.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) loadImageFile(input.files[0]); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) loadImageFile(e.dataTransfer.files[0]);
  });

  // Run
  document.getElementById('run-btn').addEventListener('click', runPipeline);

  // Export
  document.getElementById('export-png').addEventListener('click', exportPNG);
  document.getElementById('export-json').addEventListener('click', exportJSON);
  document.getElementById('export-svg').addEventListener('click', exportSVG);

  // GPU init
  try {
    gpuCtx = await GPUContext.create();
    setStatus('GPU Ready', 'ready');
    logger.success('WebGPU context initialised');
  } catch (e) {
    setStatus('No WebGPU', 'error');
    logger.error('WebGPU not available: ' + e.message);
  }
}

init();
