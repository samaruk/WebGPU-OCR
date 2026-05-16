// src/app.js – Application controller
// Wires UI → pipeline, handles progressive rendering and ZIP export
import { OCRPipeline }          from './pipeline/OCRPipeline.js';
import { GPUContext }           from './gpu/GPUContext.js';
import { FileUploader }         from './ui/FileUploader.js';
import { CanvasPanel }          from './ui/CanvasPanel.js';
import { ResultPanel }          from './ui/ResultPanel.js';
import { ExportZip }            from './ui/ExportZip.js';
import { ProgressBar }          from './ui/ProgressBar.js';
import { EVENTS }               from './pipeline/EventBus.js';
import PIPELINE_CONFIG          from './config/pipelineConfig.js';

// Stage metadata for UI
const STAGE_META = [
  { id:'stage01', idx:1,  label:'Image Decode' },
  { id:'stage02', idx:2,  label:'GPU Preprocess' },
  { id:'stage03', idx:3,  label:'Backbone Inference' },
  { id:'stage04', idx:4,  label:'DB Postprocess' },
  { id:'stage05', idx:5,  label:'Connected Components' },
  { id:'stage06', idx:6,  label:'Polygon Refinement' },
  { id:'stage07', idx:7,  label:'Layout Analysis' },
  { id:'stage08', idx:8,  label:'Table Detection' },
  { id:'stage09', idx:9,  label:'Crop & Warp' },
  { id:'stage10', idx:10, label:'Recognition Router' },
  { id:'stage11', idx:11, label:'CRNN Inference' },
  { id:'stage12', idx:12, label:'PARSeq Inference' },
  { id:'stage13', idx:13, label:'CTC Decode' },
  { id:'stage14', idx:14, label:'LM Rescore' },
  { id:'stage15', idx:15, label:'Document Assembly' },
];

export class App {
  constructor() {
    this.gpuCtx   = null;
    this.pipeline = null;
    this.file     = null;
    this._logCount = 0;
  }

  async init() {
    // ── DOM refs ──────────────────────────────────────────────────
    const dropZone     = document.getElementById('drop-zone');
    const fileInput    = document.getElementById('file-input');
    const runBtn       = document.getElementById('run-btn');
    const dlBtn        = document.getElementById('dl-btn');
    const canvasGrid   = document.getElementById('canvas-grid');
    const stageListEl  = document.getElementById('stage-list');
    const globalBar    = document.getElementById('global-bar');
    const logOut       = document.getElementById('log-out');
    const logCount     = document.getElementById('log-count');
    const hdrStatus    = document.getElementById('hdr-status');
    const previewWrap  = document.getElementById('preview-wrap');
    const previewImg   = document.getElementById('preview-img');
    const imgDims      = document.getElementById('img-dims');
    const imgKb        = document.getElementById('img-kb');

    // ── Build sidebar stage list ──────────────────────────────────
    stageListEl.innerHTML = STAGE_META.map(s => `
      <div class="si" id="si-${s.id}" onclick="document.getElementById('card-${s.id}')?.scrollIntoView({behavior:'smooth'})">
        <span class="si-dot"></span>
        <span>${s.label}</span>
        <span class="si-num">${String(s.idx).padStart(2,'0')}</span>
      </div>
    `).join('');

    // ── Build canvas grid ─────────────────────────────────────────
    const canvasPanel  = new CanvasPanel(canvasGrid, STAGE_META);
    const progressBar  = new ProgressBar(globalBar);
    const resultPanel  = new ResultPanel(document.createElement('div')); // standalone

    // ── Progress renderer ─────────────────────────────────────────
    const renderer = {
      onStageStart: (id)      => canvasPanel.setRunning(id),
      onStageDone:  (id, ms)  => {
        canvasPanel.setDone(id, ms);
        progressBar.set((STAGE_META.findIndex(s=>s.id===id)+1) / STAGE_META.length * 100);
        this._sidebarState(id, 'done');
      },
      onStageError: (id, err) => {
        canvasPanel.setError(id, err?.message ?? String(err));
        this._sidebarState(id, 'error');
      },
    };

    // ── GPU init ──────────────────────────────────────────────────
    this.gpuCtx = new GPUContext();
    try {
      await this.gpuCtx.init({ timestamps: false });
      hdrStatus.textContent = `GPU: ${(await navigator.gpu.requestAdapter())?.info?.device ?? 'WebGPU OK'}`;
      hdrStatus.style.color = '#00e676';
      this._log('WebGPU initialized', 'ok');
    } catch (e) {
      hdrStatus.textContent = 'CPU fallback';
      hdrStatus.style.color = '#ffb300';
      this._log(`WebGPU unavailable: ${e.message} — using CPU fallback`, 'warn');
      this.gpuCtx = null;
    }

    // ── Pipeline ──────────────────────────────────────────────────
    if (this.gpuCtx) {
      this.pipeline = new OCRPipeline(this.gpuCtx);

      this.pipeline.on(EVENTS.STAGE_START, ({ id, label }) => {
        renderer.onStageStart(id);
        this._sidebarState(id, 'running');
        this._log(`▶ ${label}`, 'info');
      });

      this.pipeline.on(EVENTS.STAGE_DONE, ({ id, label, ms }) => {
        renderer.onStageDone(id, ms);
        this._log(`✓ ${label} — ${ms.toFixed(0)}ms`, 'ok');
      });

      this.pipeline.on(EVENTS.STAGE_ERROR, ({ id, label, error }) => {
        renderer.onStageError(id, error);
        this._log(`✗ ${label}: ${error?.message ?? error}`, 'err');
      });

      this.pipeline.on(EVENTS.PIPELINE_DONE, ({ totalMs, data }) => {
        progressBar.done();
        runBtn.disabled = false;
        runBtn.textContent = '▶ RUN PIPELINE';
        dlBtn.style.display = 'block';
        window.__ocrDocument = data.document;
        document.getElementById('s-total').textContent = Math.round(totalMs);
        document.getElementById('s-gpu').textContent   = Math.round(data.stage02_gpuMs ?? 0);
        document.getElementById('s-regions').textContent = data.polygons?.length ?? 0;
        document.getElementById('s-chars').textContent   = data.document?.stats?.charCount ?? 0;
        this._log(`Pipeline complete in ${Math.round(totalMs)}ms`, 'ok');
      });

      this.pipeline.on('log', ({ level, msg }) => this._log(msg, level));
    } else {
      runBtn.disabled = true;
    }

    // ── File uploader ─────────────────────────────────────────────
    new FileUploader({
      dropZone, fileInput,
      onFile: (file) => {
        this.file = file;
        const url = URL.createObjectURL(file);
        previewImg.src     = url;
        previewWrap.style.display = 'block';
        imgKb.textContent  = `${(file.size/1024).toFixed(1)}KB`;
        createImageBitmap(file).then(bm => {
          imgDims.textContent = `${bm.width}×${bm.height}`;
        });
        runBtn.disabled = false;
        this._log(`File loaded: ${file.name}`, 'info');
      },
    });

    // ── Run button ────────────────────────────────────────────────
    runBtn.addEventListener('click', async () => {
      if (!this.file || !this.pipeline) return;
      runBtn.disabled = true;
      runBtn.textContent = '⬤ RUNNING…';
      progressBar.reset();
      dlBtn.style.display = 'none';
      // Reset card states
      for (const s of STAGE_META) {
        document.getElementById(`card-${s.id}`)?.classList.remove('done','running');
        const dot = document.getElementById(`dot-${s.id}`);
        if (dot) dot.classList.remove('ok');
        this._sidebarState(s.id, '');
      }
      try {
        await this.pipeline.run(this.file, canvasPanel.canvasMap);
      } catch (e) {
        runBtn.disabled = false;
        runBtn.textContent = '▶ RUN PIPELINE';
        this._log(`Pipeline error: ${e.message}`, 'err');
        console.error(e);
      }
    });

    // ── Download ZIP ──────────────────────────────────────────────
    new ExportZip(canvasPanel.canvasMap, dlBtn);

    this._log('App ready. Drop an image to begin.', 'info');
  }

  _sidebarState(id, state) {
    const el = document.getElementById(`si-${id}`);
    if (!el) return;
    el.className = `si${state ? ' '+state : ''}`;
    if (state === 'active') el.classList.add('active');
  }

  _log(msg, level = 'info') {
    const logOut   = document.getElementById('log-out');
    const logCount = document.getElementById('log-count');
    if (!logOut) return;
    this._logCount++;
    const now  = new Date().toLocaleTimeString('en-US', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const line = document.createElement('div');
    line.className = `ll ${level}`;
    line.innerHTML = `<span class="lt">${now}</span>${escapeHtml(msg)}`;
    logOut.appendChild(line);
    logOut.scrollTop = logOut.scrollHeight;
    if (logCount) logCount.textContent = `${this._logCount} entries`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
