/**
 * ui/image-upload.js
 * Handles image drag-drop / file-picker upload.
 * Converts uploaded images to a binary (black/white) canvas on the fly
 * using a threshold + channel selector + optional invert.
 *
 * Exports:
 *   setupUpload(drawCanvas, onResize)
 *   uploadState  — { image: HTMLImageElement|null, invertMode: boolean }
 *   applyBinaryMask()
 */

import { log }         from './log.js';
import { updateResUI } from './pipeline-ui.js';

export const uploadState = {
  image     : null,   // loaded HTMLImageElement
  invertMode: false,
};

const MAX_DIM = 512;

let _drawCanvas = null;
let _onResize   = null;  // callback(W, H) when canvas is resized

/**
 * Wire up all upload-related DOM interactions.
 * @param {HTMLCanvasElement} drawCanvas
 * @param {Function}          onResize  — called with (W, H) after image load
 */
export function setupUpload(drawCanvas, onResize) {
  _drawCanvas = drawCanvas;
  _onResize   = onResize;

  const dropzone  = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click',     ()   => fileInput.click());
  dropzone.addEventListener('dragover',  e    => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', ()   => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop',      e    => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) _loadFile(f);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) _loadFile(fileInput.files[0]);
  });

  // Threshold + channel selectors live-rebinarise
  const thresh  = document.getElementById('thresh');
  const chanSel = document.getElementById('chanSel');
  const btnInv  = document.getElementById('btnInvert');

  if (thresh) thresh.addEventListener('input', function () {
    document.getElementById('threshLbl').textContent = this.value;
    if (uploadState.image) applyBinaryMask();
  });
  if (chanSel)  chanSel.addEventListener('change',  () => { if (uploadState.image) applyBinaryMask(); });
  if (btnInv)   btnInv.addEventListener('click',    ()  => {
    uploadState.invertMode = !uploadState.invertMode;
    btnInv.textContent = uploadState.invertMode ? 'INVERTED ✓' : 'INVERT';
    btnInv.classList.toggle('on', uploadState.invertMode);
    if (uploadState.image) applyBinaryMask();
    else                   _invertCanvasInPlace();
  });
}

function _loadFile(file) {
  const url = URL.createObjectURL(file);
  const img  = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    uploadState.image = img;

    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const CW    = Math.round(img.width  * scale);
    const CH    = Math.round(img.height * scale);

    if (_onResize) _onResize(CW, CH);

    applyBinaryMask();

    const dzName = document.getElementById('dzName');
    if (dzName) {
      dzName.style.display = 'block';
      dzName.textContent   = `${file.name}  (${img.width}×${img.height} → ${CW}×${CH})`;
    }
    const srcLabel = document.getElementById('srcLabel');
    if (srcLabel) srcLabel.textContent = `(${CW}×${CH})`;

    log(`Image loaded: ${file.name}  ${img.width}×${img.height} → ${CW}×${CH}`, 'ok');
  };
  img.src = url;
}

/**
 * Re-binarise the uploaded image onto the draw canvas using current
 * threshold / channel / invert settings.
 */
export function applyBinaryMask() {
  if (!uploadState.image || !_drawCanvas) return;

  const W      = _drawCanvas.width;
  const H      = _drawCanvas.height;
  const thresh = +(document.getElementById('thresh')?.value  ?? 128);
  const chan   = document.getElementById('chanSel')?.value ?? 'luma';
  const invert = uploadState.invertMode;

  // Render original image into a temporary canvas at output size
  const tmp    = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.drawImage(uploadState.image, 0, 0, W, H);
  const src = tmpCtx.getImageData(0, 0, W, H).data;

  const dctx = _drawCanvas.getContext('2d', { willReadFrequently: true });
  const out  = dctx.createImageData(W, H);

  for (let i = 0; i < W * H; i++) {
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2], a = src[i * 4 + 3];
    let val;
    switch (chan) {
      case 'r'    : val = r; break;
      case 'g'    : val = g; break;
      case 'b'    : val = b; break;
      case 'alpha': val = a; break;
      default     : val = 0.299 * r + 0.587 * g + 0.114 * b; // luma
    }
    let isWhite = val > thresh;
    if (invert) isWhite = !isWhite;
    const c = isWhite ? 255 : 0;
    out.data[i * 4]     = c;
    out.data[i * 4 + 1] = c;
    out.data[i * 4 + 2] = c;
    out.data[i * 4 + 3] = 255;
  }

  dctx.putImageData(out, 0, 0);
}

function _invertCanvasInPlace() {
  if (!_drawCanvas) return;
  const ctx = _drawCanvas.getContext('2d', { willReadFrequently: true });
  const id  = ctx.getImageData(0, 0, _drawCanvas.width, _drawCanvas.height);
  for (let i = 0; i < id.data.length; i += 4) {
    id.data[i]     = 255 - id.data[i];
    id.data[i + 1] = 255 - id.data[i + 1];
    id.data[i + 2] = 255 - id.data[i + 2];
  }
  ctx.putImageData(id, 0, 0);
}
