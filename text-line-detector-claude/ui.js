/**
 * ui.js — User interface wiring: file loading, sliders, event handlers.
 *
 * BUTTON ENABLE LOGIC — single source of truth via updateRunButton():
 *   The button needs BOTH gpu AND imgRGBA ready. Either can arrive first:
 *     - GPU.init() is async (~200 ms first call).
 *     - img.onload fires when the browser finishes decoding the image.
 *   Having two places each checking only half the condition causes races.
 *   updateRunButton() checks both in one place and is called every time
 *   either variable changes. Race-free by design.
 *
 * FOUC / FORCED LAYOUT — requestAnimationFrame in uiLog():
 *   area.scrollHeight forces a synchronous layout flush when read.
 *   Deferring to rAF lets the browser paint first, then scroll.
 */

import { GPU }    from './gpu-wrapper.js';
import { CONFIG, MAX_PROC_MB } from './config.js';
import { run }    from './pipeline.js';

// Module-level state
let gpu     = null;   // set by initGPU() after WebGPU is ready
let imgRGBA = null;   // set by loadFile() after image is decoded
let imgW    = 0;
let imgH    = 0;

// ── Single source of truth for run-button enabled state ───────────────────────
// ONLY this function may set btn.disabled. Call it whenever gpu or imgRGBA changes.
function updateRunButton() {
  const btn = document.getElementById('runBtn');
  if (!btn) return;
  const ready = !!(gpu && imgRGBA);
  btn.disabled = !ready;
  console.log('[runBtn] gpu:', !!gpu, '| image:', !!imgRGBA, '| enabled:', ready);
}

// ── Logging ───────────────────────────────────────────────────────────────────
function uiLog(msg, cls = '') {
  const area = document.getElementById('logArea');
  if (!area) return;
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = '> ' + msg;
  area.appendChild(d);
  // Defer scrollHeight read to avoid forced layout during page load
  requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

function setChip(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'chip ' + cls;
}

// ── GPU initialisation ────────────────────────────────────────────────────────
async function initGPU() {
  setChip('chipGPU', 'INITIALISING', 'wait');
  try {
    gpu = await GPU.init();
    setChip('chipGPU', 'WEBGPU READY', 'ok');
    uiLog('WebGPU initialised', 'ok');
  } catch (e) {
    gpu = null;
    setChip('chipGPU', 'NO WEBGPU', 'err');
    uiLog('WebGPU failed: ' + e.message, 'err');
    uiLog('Requires Chrome 113+ or Edge 113+', 'hi');
    console.error('[GPU init]', e);
  }
  // Always update button after GPU state changes (success or failure)
  updateRunButton();
}

// ── Image loading ─────────────────────────────────────────────────────────────
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    // WHY MB-BASED DOWNSCALE INSTEAD OF A FIXED WIDTH:
    //   const MAX = 1800 was an arbitrary width cap that ignored aspect ratio.
    //   A tall-narrow image could exceed VRAM budget; a short-wide image could
    //   be over-restricted. Basing the limit on total RGBA bytes (W × H × 4)
    //   gives a consistent GPU memory budget for any aspect ratio.
    //   MAX_PROC_MB is set in config.js and easy to tune per device.
    const maxPixels = (MAX_PROC_MB * 1024 * 1024) / 4; // 4 bytes per RGBA pixel
    imgW = img.width; imgH = img.height;
    if (imgW * imgH > maxPixels) {
      const scale = Math.sqrt(maxPixels / (imgW * imgH));
      imgW = Math.floor(imgW * scale);
      imgH = Math.floor(imgH * scale);
    }

    const c = document.createElement('canvas');
    c.width = imgW; c.height = imgH;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, imgW, imgH);
    const id = ctx.getImageData(0, 0, imgW, imgH);

    // Pack R,G,B,A bytes into one u32 per pixel (little-endian)
    imgRGBA = new Uint32Array(imgW * imgH);
    for (let i = 0; i < imgW * imgH; i++) {
      imgRGBA[i] = (
         id.data[i*4]           |
        (id.data[i*4+1] <<  8)  |
        (id.data[i*4+2] << 16)  |
        (id.data[i*4+3] << 24)
      ) >>> 0;
    }

    // Show original on the first stage canvas
    const co = document.getElementById('cOrig');
    if (co) { co.width = imgW; co.height = imgH; co.getContext('2d').drawImage(img, 0, 0, imgW, imgH); }
    const iOrig = document.getElementById('iOrig');
    if (iOrig) iOrig.textContent = `${imgW}x${imgH}`;

    uiLog(`Loaded "${file.name}" — ${imgW}x${imgH}`, 'ok');
    URL.revokeObjectURL(url);

    // imgRGBA is now set — update button (enables if GPU is also ready)
    updateRunButton();
  };

  img.onerror = () => { uiLog('Could not load image', 'err'); URL.revokeObjectURL(url); };
  img.src = url;
}

// ── Run pipeline ──────────────────────────────────────────────────────────────
async function onRun() {
  if (!gpu || !imgRGBA) return;

  updateRunButton(); // disable during run (gpu && imgRGBA still true, but we override)
  const btn = document.getElementById('runBtn');
  if (btn) btn.disabled = true;

  setChip('chipProc', 'RUNNING', 'run');
  document.getElementById('chipProc').style.display = '';

  const params = {
    sauvolaRadius:   +document.getElementById('sWR').value,
    sauvolaK:        +document.getElementById('sKF').value / 100,
    invertBinary:     document.getElementById('cbInv').checked,
    skewRangeDeg:    +document.getElementById('sSR').value,
    skewStepDeg:      0.5,
    skewThreshDeg:   +document.getElementById('sST').value / 10,
    preDilationH:    +document.getElementById('sPreDH').value,
    preDilationV:    +document.getElementById('sPreDV').value,
    dilationH:       +document.getElementById('sDH').value,
    dilationV:       +document.getElementById('sDV').value,
    zsIterations:    +document.getElementById('sZI').value,
    minBranchPx:     +document.getElementById('sBP').value,
    rdpEpsilon:      +document.getElementById('sRE').value / 10,
    catmullSamples:  +document.getElementById('sCS').value,
    heightScale:     +document.getElementById('sHP').value / 10,
    minLineWidthPct: +document.getElementById('sML').value / 100,
  };

  const canvases = {
    gray: document.getElementById('cGray'), bin:  document.getElementById('cBin'),
    rot:  document.getElementById('cRot'),  dil:  document.getElementById('cDil'),
    skel: document.getElementById('cSkel'), dist: document.getElementById('cDist'),
    poly: document.getElementById('cPoly'), result: document.getElementById('cResult'),
    infoGray: document.getElementById('iGray'),   infoBin:  document.getElementById('iBin'),
    infoRot:  document.getElementById('iRot'),    infoDil:  document.getElementById('iDil'),
    infoSkel: document.getElementById('iSkel'),   infoDist: document.getElementById('iDist'),
    infoPoly: document.getElementById('iPoly'),   infoResult: document.getElementById('iResult'),
  };

  try {
    await run(imgRGBA, imgW, imgH, gpu, params, canvases, uiLog);
    setChip('chipProc', 'READY', 'ok');
  } catch (e) {
    uiLog('ERROR: ' + e.message, 'err');
    console.error('[pipeline]', e);
    setChip('chipProc', 'ERROR', 'err');
  }

  updateRunButton(); // re-enable after run completes
}

// ── Slider live-update ────────────────────────────────────────────────────────
const SLIDERS = [
  ['sWR','vWR',v=>v],        ['sKF','vKF',v=>(v/100).toFixed(2)],
  ['sSR','vSR',v=>v],        ['sST','vST',v=>(v/10).toFixed(1)],
  ['sPreDH','vPreDH',v=>v],  ['sPreDV','vPreDV',v=>v],   // pre-rotation dilation
  ['sDH','vDH',v=>v],        ['sDV','vDV',v=>v],          // post-rotation dilation
  ['sZI','vZI',v=>v],        ['sBP','vBP',v=>v],
  ['sRE','vRE',v=>(v/10).toFixed(1)], ['sCS','vCS',v=>v],
  ['sHP','vHP',v=>(v/10).toFixed(1)], ['sML','vML',v=>v],
];

// ── Entry point ───────────────────────────────────────────────────────────────
export function initUI() {
  SLIDERS.forEach(([sid,vid,fmt]) => {
    const sl = document.getElementById(sid), vl = document.getElementById(vid);
    if (sl && vl) sl.addEventListener('input', () => vl.textContent = fmt(sl.value));
  });

  const dz = document.getElementById('dz');
  if (dz) {
    dz.addEventListener('click',    ()  => document.getElementById('fi')?.click());
    dz.addEventListener('dragover', e   => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave',()  => dz.classList.remove('over'));
    dz.addEventListener('drop',     e   => { e.preventDefault(); dz.classList.remove('over'); loadFile(e.dataTransfer.files[0]); });
  }

  const fi = document.getElementById('fi');
  if (fi) fi.addEventListener('change', e => loadFile(e.target.files[0]));

  const btn = document.getElementById('runBtn');
  if (btn) btn.addEventListener('click', onRun);

  document.querySelectorAll('.stage canvas').forEach(c => {
    c.addEventListener('click', () => {
      const modal = document.getElementById('modal');
      const mi    = document.getElementById('modalImg');
      if (modal && mi) { mi.src = c.toDataURL(); modal.style.display = 'flex'; }
    });
  });

  const modal = document.getElementById('modal');
  if (modal) modal.addEventListener('click', () => { modal.style.display = 'none'; });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const b = document.getElementById('runBtn'); if (b && !b.disabled) onRun(); }
    if (e.key === 'Escape') { const m = document.getElementById('modal'); if (m) m.style.display = 'none'; }
  });

  // Start GPU — async; updateRunButton() called when it settles
  initGPU();
}
