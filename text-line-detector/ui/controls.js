/**
 * ui/controls.js — Sidebar parameter sliders, file-upload zone, status/progress helpers.
 *
 * WHY A DEDICATED UI MODULE:
 *   UI initialisation is boilerplate that shouldn't clutter main.js. More importantly,
 *   separating UI code from pipeline orchestration (main.js) and algorithms (gpu/, cpu/)
 *   means a design change (adding a slider, changing a label) doesn't risk accidentally
 *   breaking the GPU pipeline — the modules don't share state beyond the `cfg` object.
 *
 * PATTERN — callback-based decoupling:
 *   initControls receives two callbacks (onImageLoaded, onRunPipeline) from main.js.
 *   This keeps ui/controls.js free of imports from gpu/ or cpu/ — the UI doesn't need
 *   to know how the pipeline works, only that it can trigger it.
 */

import { cfg, MAX_PROC_MB } from '../config.js';

// ── DOM helpers ────────────────────────────────────────────────────────────────

/** setStatus — Update the sidebar status box with a message and optional style class. */
export function setStatus(msg, type = '') {
  const el = document.getElementById('statusBox');
  el.textContent = msg;
  el.className = 'status-box ' + type;
}

/** setProgress — Update the progress bar (0–100%). */
export function setProgress(pct) {
  document.getElementById('progressBar').style.width = pct + '%';
}

// ── Control initialisation ─────────────────────────────────────────────────────

/**
 * initControls — Wire up all sidebar sliders and the file upload zone.
 *
 * @param {function} onImageLoaded  — called with (HTMLImageElement, procW, procH) when ready
 * @param {function} onRunPipeline  — called with no args when the RUN button is clicked
 *
 * WHY [id, displayId, decimalPlaces] TUPLES:
 *   Each slider has a companion <span> that shows the current value. The decimal places
 *   field controls toFixed() formatting so integer params (radius, dilW) show without
 *   trailing ".0" while float params (k) show two decimal places.
 */
export function initControls(onImageLoaded, onRunPipeline) {
  // ── Sliders ──────────────────────────────────────────────────────────────
  [
    ['radius',   'v_radius',   0],
    ['k',        'v_k',        2],
    ['dilW',     'v_dilW',     0],
    ['dilH',     'v_dilH',     0],
    ['minArea',  'v_minArea',  0],
    ['minLen',   'v_minLen',   0],
    ['zsIters',  'v_zsIters',  0],
    ['ccaIters', 'v_ccaIters', 0],
  ].forEach(([id, vid, dec]) => {
    const el = document.getElementById('p_' + id);
    const vl = document.getElementById(vid);
    if (!el) return;
    el.addEventListener('input', () => {
      cfg[id] = parseFloat(el.value);
      vl.textContent = cfg[id].toFixed(dec);
    });
  });

  // ── File upload zone ──────────────────────────────────────────────────────
  const uploadZone = document.getElementById('uploadZone');
  const fileInput  = document.getElementById('fileInput');
  uploadZone.addEventListener('click',     () => fileInput.click());
  uploadZone.addEventListener('dragover',  e  => { e.preventDefault(); uploadZone.classList.add('over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('over'));
  uploadZone.addEventListener('drop',      e  => {
    e.preventDefault(); uploadZone.classList.remove('over');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0], onImageLoaded);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0], onImageLoaded);
  });

  // ── Run button ────────────────────────────────────────────────────────────
  document.getElementById('detectBtn').addEventListener('click', onRunPipeline);
}

/**
 * loadFile — Load a dropped or selected image file and compute processing dimensions.
 *
 * WHY procW/procH COMPUTED HERE (not in main.js):
 *   Scaling logic depends on MAX_PROC_MB from config.js. The UI layer is responsible
 *   for translating user input (a file) into parameters the pipeline can consume
 *   (an ImageData at the correct processing resolution). main.js should only orchestrate,
 *   not implement scaling policy.
 *
 * WHY URL.createObjectURL (not FileReader.readAsDataURL):
 *   createObjectURL produces a Blob URL directly — no base64 encoding, no memory
 *   duplication. The image element loads from the Blob URL natively. For a 20 MB TIFF
 *   this is significantly faster and uses less memory than a base64 data URL.
 */
function loadFile(file, onImageLoaded) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    let procW = img.naturalWidth, procH = img.naturalHeight;
    const memMB = (procW * procH * 4) / (1024 * 1024);
    if (memMB > MAX_PROC_MB) {
      const scale = Math.sqrt(MAX_PROC_MB / memMB);
      procW = Math.floor(procW * scale);
      procH = Math.floor(procH * scale);
    }

    // Show the input image at original resolution.
    document.getElementById('inputImg').src = img.src;
    document.getElementById('inputImg').style.display = 'block';
    document.getElementById('ph_input').style.display = 'none';

    document.getElementById('detectBtn').disabled = false;
    setStatus(
      memMB > MAX_PROC_MB
        ? `Loaded ${img.naturalWidth}×${img.naturalHeight} (${memMB.toFixed(1)} MB) — processing at ${procW}×${procH}.`
        : `Loaded ${img.naturalWidth}×${img.naturalHeight} (${memMB.toFixed(1)} MB). Press RUN.`
    );
    setProgress(0);
    onImageLoaded(img, procW, procH);
  };
  img.onerror = () => setStatus('Failed to load image.', 'err');
  img.src = url;
}
