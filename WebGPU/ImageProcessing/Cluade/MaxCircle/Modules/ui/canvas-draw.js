/**
 * ui/canvas-draw.js
 * Manual painting on the binary-mask canvas.
 * Supports mouse + touch, foreground (white) / background (black) modes.
 *
 * Exports:
 *   setupDrawCanvas(canvas, overlayCanvas)
 *   clearCanvas(canvas, W, H)
 */

let _drawCanvas   = null;
let _overlayCanvas = null;
let _painting      = false;
let _drawMode      = 1;  // 1 = white (foreground), 0 = black (background)

/**
 * Wire up all drawing interactions.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLCanvasElement} overlayCanvas
 */
export function setupDrawCanvas(canvas, overlayCanvas) {
  _drawCanvas    = canvas;
  _overlayCanvas = overlayCanvas;

  // Foreground / Background toggle
  const btnFore = document.getElementById('btnFore');
  const btnBack = document.getElementById('btnBack');
  if (btnFore) btnFore.addEventListener('click', () => {
    _drawMode = 1;
    btnFore.classList.add('on');
    btnBack?.classList.remove('on');
  });
  if (btnBack) btnBack.addEventListener('click', () => {
    _drawMode = 0;
    btnBack.classList.add('on');
    btnFore?.classList.remove('on');
  });

  // Brush size label
  const brushSz = document.getElementById('brushSize');
  if (brushSz) brushSz.addEventListener('input', () => {
    const lbl = document.getElementById('brushLbl');
    if (lbl) lbl.textContent = brushSz.value;
  });

  // Mouse events
  canvas.addEventListener('mousedown', e  => { _painting = true; _paint(e); });
  canvas.addEventListener('mousemove', _paint);
  canvas.addEventListener('mouseup',   ()  => { _painting = false; });
  canvas.addEventListener('mouseleave',()  => { _painting = false; });

  // Touch events
  canvas.addEventListener('touchstart', e => { _painting = true;  _paint(e); }, { passive: false });
  canvas.addEventListener('touchmove',  _paint, { passive: false });
  canvas.addEventListener('touchend',   () => { _painting = false; });
}

function _getPos(e) {
  const r = _drawCanvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return [t.clientX - r.left, t.clientY - r.top];
}

function _paint(e) {
  if (!_painting) return;
  e.preventDefault();
  const [x, y]  = _getPos(e);
  const brushSz  = document.getElementById('brushSize');
  const radius   = brushSz ? +brushSz.value : 14;
  const ctx      = _drawCanvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle  = _drawMode ? '#fff' : '#000';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Fill the draw canvas with black and clear the overlay.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLCanvasElement} overlayCanvas
 */
export function clearCanvas(canvas, overlayCanvas) {
  const dctx = canvas.getContext('2d', { willReadFrequently: true });
  dctx.fillStyle = '#000';
  dctx.fillRect(0, 0, canvas.width, canvas.height);

  if (overlayCanvas) {
    const octx = overlayCanvas.getContext('2d');
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }
}
