
import { gpuCtx }             from './core/gpuContext.js';
import { TextureManager }     from './core/textureManager.js';
import { BufferManager }      from './core/bufferManager.js';
import { Visualizer }         from './utils/visualization.js';
import { PerfMonitor }        from './utils/perfMonitor.js';
import { loadImageToTexture } from './utils/imageLoader.js';
import { analyzeBlobsForConditionalStages } from './utils/blobAnalyzer.js';
import { Recognizer }         from './utils/recognizer.js';
import { CONFIG }             from './config.js';

import { SobelStage }           from './stages/01_sobelEdge/sobelStage.js';
import { AdaptiveThresholdStage } from './stages/02_adaptiveThreshold/adaptiveThresholdStage.js';
import { CCLStage }             from './stages/03_connectedComponents/cclStage.js';
import { SWTStage }             from './stages/04_strokeWidthTransform/swtStage.js';
import { LineStage }            from './stages/05_textLineDetection/lineStage.js';
import { WatershedStage }       from './stages/06_watershedSplit/watershedStage.js';
import { ProjectionStage }      from './stages/07_projectionSegmentation/projectionStage.js';
import { SkeletonStage }        from './stages/08_skeletonSplit/skeletonStage.js';
import { ResegmentStage }       from './stages/09_recognitionResegment/resegmentStage.js';

// ── Stage metadata ───────────────────────────────────────────
const STAGE_META = [
  { id:'input',      n:0,  title:'Input Image',                sub:'' },
  { id:'sobel',      n:1,  title:'Sobel Edge Detection',       sub:'Gx²+Gy² magnitude' },
  { id:'adaptive',   n:2,  title:'Adaptive Threshold',         sub:'Parallel prefix-sum integral' },
  { id:'ccl',        n:3,  title:'Connected Components',       sub:'Convergence-detected CCL' },
  { id:'swt',        n:4,  title:'Stroke Width Transform',     sub:'Binary edges → ray-cast SWT' },
  { id:'lines',      n:5,  title:'Text Line Detection',        sub:'Horizontal projection valleys' },
  { id:'watershed',  n:6,  title:'Watershed Split',            sub:'JFA distance + BFS grow  [conditional]' },
  { id:'projection', n:7,  title:'Projection Segmentation',    sub:'Vertical projection cuts  [conditional]' },
  { id:'skeleton',   n:8,  title:'Skeleton Split',             sub:'Zhang-Suen + junctions  [conditional]' },
  { id:'resegment',  n:9,  title:'Recognition Resegment',      sub:'Confidence map  [conditional]' },
];
const PERF_STAGES = ['sobel','adaptive','ccl','swt','lines','watershed','projection','skeleton','resegment'];

// ── DOM ──────────────────────────────────────────────────────
const grid       = document.getElementById('grid');
const imgFile    = document.getElementById('imgFile');
const runBtn     = document.getElementById('runBtn');
const dlBtn      = document.getElementById('dlBtn');
const statusMsg  = document.getElementById('statusMsg');
const pgFill     = document.getElementById('pgFill');
const perfChips  = document.getElementById('perf-chips');
const resultsEl  = document.getElementById('results-text');
const confBadge  = document.getElementById('conf-badge');

// Build stage cards
const canvases = {};
STAGE_META.forEach(s => {
  const card = document.createElement('div');
  card.className = 'stage-card';
  card.id = `card-${s.id}`;
  const canvas = document.createElement('canvas');
  canvases[s.id] = canvas;
  card.innerHTML = `
    <div class="stage-card-header">
      <div class="stage-num">${s.n}</div>
      <div class="stage-title">${s.title}</div>
    </div>`;
  const wrap = document.createElement('div');
  wrap.className = 'stage-canvas-wrap';
  const ph = document.createElement('span');
  ph.className = 'stage-placeholder'; ph.id = `ph-${s.id}`;
  ph.textContent = s.id.includes('shed')||s.id==='projection'||s.id==='skeleton'||s.id==='resegment'
                   ? 'Conditional – awaiting CCL analysis…' : 'Waiting…';
  wrap.appendChild(ph); wrap.appendChild(canvas);
  card.appendChild(wrap);
  if (s.sub) {
    const ft = document.createElement('div');
    ft.className='stage-footer';
    ft.innerHTML=`<span>${s.sub}</span><span class="badge" id="badge-${s.id}">–</span>`;
    card.appendChild(ft);
  }
  grid.appendChild(card);
});

// ── State ─────────────────────────────────────────────────────
let loadedFile = null;
let recognizer = null;

imgFile.addEventListener('change', e => {
  loadedFile = e.target.files[0];
  if (!loadedFile) return;
  const url = URL.createObjectURL(loadedFile);
  const img = new Image();
  img.onload = () => {
    const c = canvases.input;
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    document.getElementById('ph-input').style.display = 'none';
    URL.revokeObjectURL(url);
  };
  img.src = url;
  runBtn.disabled = false;
  setStatus('Image loaded – click ▶ Run Pipeline');
});

runBtn.addEventListener('click', runPipeline);
dlBtn.addEventListener('click',  downloadZip);

// ── Pipeline ──────────────────────────────────────────────────
async function runPipeline() {
  if (!loadedFile) return;
  runBtn.disabled = true; dlBtn.disabled = true;
  setStatus('Initialising WebGPU…'); setProgress(0);

  try {
    await gpuCtx.init();
    const { device } = gpuCtx;

    // FIX: reset managers between runs to prevent VRAM leaks
    const texMgr = new TextureManager(device);
    const bufMgr = new BufferManager(device);
    const viz    = new Visualizer(device);
    const perf   = new PerfMonitor(device, PERF_STAGES);

    setStatus('Loading image to GPU…');
    const { texture: inputTex, width, height } =
      await loadImageToTexture(device, loadedFile);
    CONFIG.width = width; CONFIG.height = height;
    setProgress(5);

    STAGE_META.forEach(s => {
      canvases[s.id].width = width; canvases[s.id].height = height;
    });

    // ── Compile all stage shaders once ──────────────────────
    setStatus('Compiling shaders (one-time)…');
    const stages = {
      sobel:      new SobelStage(device, texMgr),
      adaptive:   new AdaptiveThresholdStage(device, texMgr, bufMgr),
      ccl:        new CCLStage(device, texMgr, bufMgr),
      swt:        new SWTStage(device, texMgr, bufMgr),
      lines:      new LineStage(device, texMgr, bufMgr),
      watershed:  new WatershedStage(device, texMgr, bufMgr),
      projection: new ProjectionStage(device, texMgr, bufMgr),
      skeleton:   new SkeletonStage(device, texMgr, bufMgr),
      resegment:  new ResegmentStage(device, texMgr, bufMgr),
    };
    await Promise.all(Object.values(stages).map(s => s.init()));
    setProgress(20);

    // ── PHASE 1: encode always-on stages (1–5) ──────────────
    setStatus('Running GPU pipeline phases 1–5…');
    const perfHook = perf.hook();

    // Instrument each stage with its own error scope so the console
    // reports exactly which pass triggers the binding-count mismatch.
    const runWithScope = async (label, fn) => {
      device.pushErrorScope('validation');
      const enc = device.createCommandEncoder({ label });
      const result = fn(enc);
      const err = await device.popErrorScope();
      if (err) { console.error(`[${label}] WebGPU validation error:`, err.message); }
      device.queue.submit([enc.finish()]);
      return result;
    };

    const sobelTex  = await runWithScope('sobel-pass',    enc => stages.sobel.run(enc, inputTex, width, height));
    const binaryTex = await runWithScope('adaptive-pass', enc => stages.adaptive.run(enc, inputTex, width, height));
    const swtTex    = await runWithScope('swt-pass',      enc => stages.swt.run(enc, binaryTex, width, height));
    const linesTex  = await runWithScope('lines-pass',    enc => stages.lines.run(enc, binaryTex, width, height));
    setProgress(40);

    // ── PHASE 2: CCL with convergence detection ──────────────
    setStatus('Running CCL with convergence detection…');
    const t0ccl = performance.now();
    const { labelsBuf, visualTex: cclTex, batches: cclBatches } =
      await stages.ccl.run(binaryTex, width, height);
    const cclMs = (performance.now() - t0ccl).toFixed(1);
    setStatus(`CCL converged in ${cclBatches} batch(es) (${cclMs}ms)`);
    await stages.ccl.colorize(viz);
    setProgress(55);

    // ── PHASE 3: analyze blobs → decide conditional stages ───
    setStatus('Analysing blobs for conditional stage gating…');
    const { needsTouchingStages, blobCount, maxAspect } =
      await analyzeBlobsForConditionalStages(device, labelsBuf, width, height);

    console.log(`[BlobAnalyzer] blobs=${blobCount}, maxAspect=${maxAspect}, runTouching=${needsTouchingStages}`);
    setStatus(`${blobCount} blobs, maxAspect=${maxAspect} → touching stages: ${needsTouchingStages ? '✅ YES' : '⏭ SKIP'}`);
    setProgress(65);

    // ── PHASE 4: conditional stages (6–9) ────────────────────
    let wsTex, projTex, skelTex, resegTex;
    let touchingMs = null;

    if (needsTouchingStages) {
      setStatus('Running touching-character split stages…');
      const enc2 = device.createCommandEncoder({ label:'phase2' });

      perfHook.beginPass('watershed',  enc2);
      const wsResult = stages.watershed.run(enc2, binaryTex, width, height);
      wsTex = wsResult.visualTex;
      perfHook.endPass('watershed',    enc2);

      perfHook.beginPass('projection', enc2);
      projTex = stages.projection.run(enc2, binaryTex, width, height);
      perfHook.endPass('projection',   enc2);

      perfHook.beginPass('skeleton',   enc2);
      skelTex = stages.skeleton.run(enc2, binaryTex, width, height);
      perfHook.endPass('skeleton',     enc2);

      perfHook.beginPass('resegment',  enc2);
      resegTex = stages.resegment.run(enc2, swtTex, binaryTex, width, height);
      perfHook.endPass('resegment',    enc2);

      await perfHook.resolveAll(enc2);
      const t0t = performance.now();
      device.queue.submit([enc2.finish()]);
      await device.queue.onSubmittedWorkDone();
      touchingMs = (performance.now() - t0t).toFixed(1);
      await stages.watershed.colorize(viz);
    } else {
      // Mark conditional cards as skipped
      ['watershed','projection','skeleton','resegment'].forEach(id => {
        document.getElementById(`card-${id}`)?.classList.add('skipped');
        const ph = document.getElementById(`ph-${id}`);
        if (ph) ph.textContent = 'Skipped – no touching characters detected';
      });
    }
    setProgress(85);

    // ── Blit all outputs to canvases ──────────────────────────
    setStatus('Rendering stage outputs…');
    const outputs = {
      sobel: sobelTex, adaptive: binaryTex, ccl: cclTex,
      swt: swtTex, lines: linesTex,
      ...(wsTex   ? { watershed:  wsTex   } : {}),
      ...(projTex ? { projection: projTex } : {}),
      ...(skelTex ? { skeleton:   skelTex } : {}),
      ...(resegTex? { resegment:  resegTex} : {}),
    };
    for (const [id, tex] of Object.entries(outputs)) {
      viz.blitToCanvas(tex, canvases[id]);
      const ph = document.getElementById(`ph-${id}`);
      if (ph) ph.style.display = 'none';
      const badge = document.getElementById(`badge-${id}`);
      if (badge) badge.textContent = `${width}×${height}`;
    }
    setProgress(92);

    // ── Read perf timings ─────────────────────────────────────
    const timings = await perfHook.readResults();
    renderPerfChips(timings);

    // ── Tesseract recognition pass ────────────────────────────
    setStatus('Running Tesseract OCR recognition…');
    try {
      if (!recognizer) {
        recognizer = new Recognizer();
        await recognizer.init(m => {
          if (m.status === 'recognizing text')
            setStatus(`Tesseract: ${Math.round(m.progress*100)}%`);
        });
      }
      // Feed the best segmentation result to Tesseract
      // Always use the clean adaptive threshold binary for OCR.
      // Resegment output is for visualisation only (has colour markers that confuse Tesseract).
      const srcCanvas = canvases.adaptive;
      const result = await recognizer.recognize(srcCanvas);
      resultsEl.textContent = result.text || '(no text detected)';
      confBadge.textContent = `${result.confidence}% confidence`;
      confBadge.style.background = result.confidence > 70
        ? 'rgba(16,185,129,.2)' : 'rgba(244,63,94,.2)';
    } catch(e) {
      resultsEl.textContent = `OCR error: ${e.message}`;
    }
    setProgress(100);
    setStatus(`✅ Complete — ${width}×${height} | CCL: ${cclBatches} batch(es)${touchingMs?` | touching: ${touchingMs}ms`:''}`);
    dlBtn.disabled = false;

  } catch (err) {
    setStatus(`❌ ${err.message}`); console.error(err);
  } finally {
    runBtn.disabled = false;
  }
}

// ── ZIP Download ──────────────────────────────────────────────
async function downloadZip() {
  setStatus('Packaging results…');
  const zip = new JSZip();
  for (const [id, canvas] of Object.entries(canvases)) {
    const blob = await new Promise(res => canvas.toBlob(res,'image/png'));
    if (blob) zip.file(`stage_${id}.png`, blob);
  }
  // Include OCR text
  zip.file('ocr_result.txt', resultsEl.textContent);
  const blob = await zip.generateAsync({ type:'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gpu-ocr-revised-output.zip';
  a.click();
  setStatus('ZIP downloaded.');
}

// ── Helpers ───────────────────────────────────────────────────
function setStatus(msg) { statusMsg.textContent = msg; }
function setProgress(p) { pgFill.style.width = `${p}%`; }

function renderPerfChips(timings) {
  perfChips.innerHTML = '';
  for (const [name, ms] of Object.entries(timings)) {
    if (!ms && ms !== 0) continue;
    const chip = document.createElement('span');
    chip.className = `perf-chip${ms > 10 ? ' slow' : ''}`;
    chip.textContent = `${name}: ${ms.toFixed(2)}ms`;
    perfChips.appendChild(chip);
  }
}
