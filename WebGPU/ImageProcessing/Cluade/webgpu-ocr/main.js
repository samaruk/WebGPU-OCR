
import { initGPU, adapterInfo }       from './core/gpuContext.js';
import { CONFIG }                     from './config.js';
import { fileToImage, imageToRGBAFloat } from './utils/imageLoader.js';

import { UploadStage}
    from './pipelines/01_input/uploadStage.js';
import { UploadVisualizer }
    from './pipelines/01_input/uploadvisualizer.js';
import { PreprocessStage}
    from './pipelines/02_preprocess/preprocessStage.js';
import { PreprocessVisualizer }
    from './pipelines/02_preprocess/preprocessvisualizer.js';
import { FeatureStage }
    from './pipelines/03_feature_extraction/featureStage.js';
import { FeatureVisualizer }
    from './pipelines/03_feature_extraction/featurevisualizer.js';
import { SuperpointStage, SuperpointVisualizer }
  from './pipelines/04_superpoint/superpointStage.js';
import { MatchingStage, MatchingVisualizer }
  from './pipelines/05_feature_matching/matchingStage.js';
import { DetectionStage, DetectionVisualizer }
  from './pipelines/06_text_detection/detectionStage.js';
import { RegionStage, RegionVisualizer }
  from './pipelines/07_region_extraction/regionExtractionStage.js';
import { GraphSegStage, GraphSegVisualizer }
  from './pipelines/08_graph_segmentation/graphSegmentationStage.js';
import { LayoutStage, LayoutVisualizer }
  from './pipelines/09_layout_analysis/layoutStage.js';
import { TableStage, TableVisualizer }
  from './pipelines/10_table_detection/tableStage.js';
import { GeometryStage, GeometryVisualizer }
  from './pipelines/11_geometry/geometryStage.js';
import { EncoderStage, EncoderVisualizer }
  from './pipelines/12_recognition_encoder/encoderStage.js';
import { TransformerStage, TransformerVisualizer }
  from './pipelines/13_transformer/transformerStage.js';
import { ClassifierStage, ClassifierVisualizer }
  from './pipelines/14_classifier/classifierStage.js';
import { DecodeStage, DecodeVisualizer }
  from './pipelines/15_gpu_decode/decodeStage.js';
import { StructureStage, StructureVisualizer }
  from './pipelines/16_document_structure/structureStage.js';

// ── UI helpers ────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

function setProgress(pct, label) {
  $('progress-bar').style.width = `${pct}%`;
  $('progress-label').textContent = label;
}

function setStageStatus(key, status, ms) {
  const card = document.querySelector(`[data-stage="${key}"]`);
  if (!card) return;
  const st = card.querySelector('.stage-status');
  if (st) { st.textContent = status.toUpperCase(); st.className = `stage-status ${status}`; }
  if (ms !== undefined) {
    const t = card.querySelector('.stage-time');
    if (t) t.textContent = `${ms.toFixed(1)}ms`;
  }
  card.className = `stage-card ${status}`;
}

function buildStageCards() {
  const grid = $('stages-grid');
  grid.innerHTML = '';
  for (const s of CONFIG.STAGES) {
    const card = document.createElement('div');
    card.className = 'stage-card';
    card.dataset.stage = s.key;
    card.innerHTML = `
      <div class="stage-header">
        <span class="stage-num">${s.id}</span>
        <span class="stage-name">${s.name}</span>
        <span class="stage-status idle">IDLE</span>
      </div>
      <div class="stage-canvas-wrap">
        <canvas class="stage-canvas" id="canvas-${s.key}"></canvas>
      </div>
      <div class="stage-info">
        <span>${s.key}</span>
        <span class="stage-time">–</span>
      </div>
    `;
    grid.appendChild(card);
  }
}

// ── Main app ─────────────────────────────────────────────────────────────────

let device = null;
let currentFile = null;

async function boot() {
  setProgress(0, 'INITIALISING WEBGPU…');
  try {
    const { device: dev, adapter } = await initGPU();
    device = dev;
    $('gpu-name').textContent = adapterInfo();
    setProgress(5, 'GPU READY');
  } catch (err) {
    $('gpu-name').textContent = 'NOT AVAILABLE';
    setProgress(0, `ERROR: ${err.message}`);
    console.error(err);
  }
}

function handleFile(file) {
  if (!file) return;
  currentFile = file;
  const url = URL.createObjectURL(file);
  const img  = new Image();
  img.onload = () => {
    const c = $('canvas-source');
    c.width  = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    $('btn-run').disabled  = false;
    $('btn-zip').disabled  = true;
    buildStageCards();
    setProgress(10, 'IMAGE LOADED — READY');
  };
  img.src = url;
}

async function runPipeline() {
  if (!device || !currentFile) return;
  $('btn-run').disabled = true;
  $('btn-zip').disabled = true;
  const t0 = performance.now();

  const img = await fileToImage(currentFile);
  const ctx = document.createElement('canvas');
  ctx.width  = img.naturalWidth;
  ctx.height = img.naturalHeight;
  ctx.getContext('2d').drawImage(img, 0, 0);
  const imageData = ctx.getContext('2d').getImageData(0, 0, ctx.width, ctx.height);

  // Instantiate stages
  const stages = [
    ['input',       new UploadStage(device),       new UploadVisualizer()       ],
    ['preprocess',  new PreprocessStage(device),    new PreprocessVisualizer()   ],
    ['features',    new FeatureStage(device),       new FeatureVisualizer()      ],
    ['superpoint',  new SuperpointStage(device),    new SuperpointVisualizer()   ],
    ['matching',    new MatchingStage(device),      new MatchingVisualizer()     ],
    ['detection',   new DetectionStage(device),     new DetectionVisualizer()    ],
    ['regions',     new RegionStage(device),        new RegionVisualizer()       ],
    ['graphseg',    new GraphSegStage(device),      new GraphSegVisualizer()     ],
    ['layout',      new LayoutStage(device),        new LayoutVisualizer()       ],
    ['tables',      new TableStage(device),         new TableVisualizer()        ],
    ['geometry',    new GeometryStage(device),      new GeometryVisualizer()     ],
    ['encoder',     new EncoderStage(device),       new EncoderVisualizer()      ],
    ['transformer', new TransformerStage(device),   new TransformerVisualizer()  ],
    ['classifier',  new ClassifierStage(device),    new ClassifierVisualizer()   ],
    ['decode',      new DecodeStage(device),        new DecodeVisualizer()       ],
    ['structure',   new StructureStage(device),     new StructureVisualizer()    ],
  ];

  // Init all
  setProgress(12, 'COMPILING SHADERS…');
  await Promise.all(stages.map(([, s]) => s.init()));
  setProgress(20, 'SHADERS COMPILED');

  let result = imageData;
  const total = stages.length;

  for (let i = 0; i < stages.length; i++) {
    const [key, stage, viz] = stages[i];
    setStageStatus(key, 'running');
    const t = performance.now();
    try {
      result = await stage.run(result);
      const ms = performance.now() - t;
      setStageStatus(key, 'done', ms);

      // Visualize
      const canvas = $(`canvas-${key}`);
      if (canvas) {
        try { await viz.visualize(result, canvas); } catch (_) {}
      }
    } catch (err) {
      console.error(`[Stage ${key}]`, err);
      setStageStatus(key, 'error', 0);
    }
    setProgress(20 + Math.round(75 * (i + 1) / total),
      `[${String(i+1).padStart(2,'0')}/${total}] ${key.toUpperCase()}…`);
  }

  const totalMs = performance.now() - t0;
  $('total-time').textContent = `Total: ${(totalMs/1000).toFixed(2)}s`;
  setProgress(100, 'PIPELINE COMPLETE');
  $('btn-run').disabled  = false;
  $('btn-zip').disabled  = false;
}

async function downloadZip() {
  // Collect all stage canvases and zip them
  const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')).default
                 ?? window.JSZip;

  if (typeof JSZip === 'undefined') {
    // Fallback: download canvases individually
    for (const s of CONFIG.STAGES) {
      const c = $(`canvas-${s.key}`);
      if (!c || !c.width) continue;
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `${s.id}_${s.key}.png`;
      a.click();
      await new Promise(r => setTimeout(r, 100));
    }
    return;
  }

  const zip = new JSZip();
  const folder = zip.folder('webgpu-ocr-stages');
  for (const s of CONFIG.STAGES) {
    const c = $(`canvas-${s.key}`);
    if (!c || !c.width) continue;
    const dataUrl = c.toDataURL('image/png');
    const b64 = dataUrl.split(',')[1];
    folder.file(`${s.id}_${s.key}.png`, b64, { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'webgpu-ocr-stages.zip';
  a.click();
}

// ── Event wiring ──────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  await boot();

  const dropArea = $('drop-area');
  const fileInput = $('file-input');

  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.className = 'drop-over'; });
  dropArea.addEventListener('dragleave', () => { dropArea.className = 'drop-idle'; });
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.className = 'drop-idle';
    handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  $('btn-run').addEventListener('click', runPipeline);
  $('btn-zip').addEventListener('click', downloadZip);
  $('btn-clear').addEventListener('click', () => {
    currentFile = null;
    $('btn-run').disabled = true;
    $('btn-zip').disabled = true;
    $('canvas-source').width = 0;
    $('stages-grid').innerHTML = '';
    setProgress(0, 'IDLE');
    $('total-time').textContent = '';
  });
});
