/**
 * @file ui.js
 * @description Lightweight DOM/UI utility functions for the Sauvola pipeline interface.
 *
 * This module contains:
 *  • DOM accessor shorthand
 *  • Pipeline step indicator management
 *  • Error banner display
 *  • Canvas placeholder toggling
 *  • Image loading from File objects (with 128 MB memory guard)
 *  • Shared `currentImgData` state and setter
 *  • Slider label synchronisation
 *  • Drop-zone event wiring
 *
 * Design philosophy
 * ─────────────────
 * All UI mutations are synchronous and side-effect–only (no return values
 * that need to be awaited, no Promises except loadFile which wraps Image.onload).
 * Keeping DOM operations out of the algorithm modules (gpu.js, rendering.js, …)
 * makes them easier to test and port to non-browser environments.
 *
 * Public API
 * ──────────
 *  $                          DOM accessor: id → HTMLElement
 *  showError(msg)             Display an error in the error banner.
 *  setStep(n)                 Highlight step n in the pipeline indicator.
 *  showCanvas(id, phId)       Reveal a canvas, hide its placeholder.
 *  loadFile(file)             Load an image File, resize if >128 MB, set as current.
 *  setCurrentImage(data, info) Set the current ImageData and update the UI.
 *  getCurrentImage()          Return the current ImageData (or null).
 *  initSliders()              Wire slider inputs to their label elements.
 *  initDropZone()             Wire drag-and-drop + click-to-browse on the drop zone.
 */

import { MAX_IMAGE_BYTES } from './config.js';

// ── SHARED STATE ───────────────────────────────────────────────────────────────

/**
 * The currently loaded image data, shared between ui.js and main.js.
 * Updated by `setCurrentImage`; read by the Run Pipeline handler in main.js.
 *
 * @type {ImageData|null}
 */
let currentImgData = null;

// ── DOM UTILITIES ──────────────────────────────────────────────────────────────

/**
 * Shorthand for `document.getElementById`.
 *
 * @param {string} id - Element id.
 * @returns {HTMLElement}
 *
 * @example
 * $('processBtn').disabled = true;
 */
export const $ = id => document.getElementById(id);

/**
 * Display an error message in the top error banner.
 *
 * The banner is hidden by default (display:none in CSS) and becomes visible
 * when this function is called.  It is hidden again at the start of each
 * new pipeline run.
 *
 * @param {string} msg - Human-readable error description.
 */
export function showError(msg) {
  const b = $('errBanner');
  b.textContent = '⚠ ' + msg;
  b.style.display = 'block';
}

/**
 * Highlight step `n` in the pipeline indicator sidebar widget.
 *
 * Each `.pipe-step` element has a `data-step` attribute (0-indexed).
 * Exactly one step is given the `active` class at a time, causing it to
 * display with an amber left border and highlighted text.
 *
 * @param {number} n - Zero-based step index to activate.
 */
export function setStep(n) {
  document.querySelectorAll('.pipe-step').forEach((el, i) => {
    el.classList.toggle('active', i === n);
  });
}

/**
 * Make a canvas visible and hide its sibling placeholder element.
 *
 * Canvases start hidden (display:none) so the placeholder text is shown
 * until results are available.  This function swaps them.
 *
 * @param {string} canvasId      - Id of the <canvas> to reveal.
 * @param {string} placeholderId - Id of the placeholder <div> to hide.
 */
export function showCanvas(canvasId, placeholderId) {
  $(canvasId).style.display = 'block';
  if (placeholderId) $(placeholderId).style.display = 'none';
}

// ── IMAGE STATE ────────────────────────────────────────────────────────────────

/**
 * Return the currently loaded image data.
 *
 * @returns {ImageData|null}
 */
export function getCurrentImage() {
  return currentImgData;
}

/**
 * Store a new ImageData as the current image and update the UI.
 *
 * - Draws the image on the #cOrig canvas.
 * - Hides the original-panel placeholder.
 * - Updates the panel info label.
 * - Enables the Run Pipeline button.
 *
 * @param {ImageData} imgData - Pixel data to store.
 * @param {string}    [info=''] - Short descriptor shown in the panel header
 *   (e.g. '1920×1080' or '640×480 · demo #1').
 */
export function setCurrentImage(imgData, info = '') {
  currentImgData = imgData;

  const cv = $('cOrig');
  cv.width  = imgData.width;
  cv.height = imgData.height;
  cv.getContext('2d').putImageData(imgData, 0, 0);

  $('phOrig').style.display     = 'none';
  $('origInfo').textContent      = info;
  $('processBtn').disabled       = false;
}

/**
 * Load an image from a File object into the pipeline.
 *
 * Memory guard
 * ─────────────
 * The raw pixel budget is width × height × 4 bytes (RGBA).
 * If the loaded image would exceed MAX_IMAGE_BYTES, it is uniformly scaled
 * down so that width × height × 4 = MAX_IMAGE_BYTES exactly (rounded to
 * nearest integer dimensions, preserving aspect ratio).
 *
 * Processing
 * ──────────
 *  1. Create an object URL for the file.
 *  2. Load into a temporary Image element.
 *  3. Draw onto a scratch canvas at the (possibly scaled) dimensions.
 *  4. Call setCurrentImage with the extracted ImageData.
 *  5. Revoke the object URL to free browser memory.
 *
 * @param {File} file - An image file (JPEG, PNG, TIFF, WebP, …).
 */
export function loadFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    let w = img.width, h = img.height;

    // Scale down only if the raw pixel data would exceed the budget
    const bytes = w * h * 4;
    if (bytes > MAX_IMAGE_BYTES) {
      const s = Math.sqrt(MAX_IMAGE_BYTES / bytes);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }

    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);

    setCurrentImage(cv.getContext('2d').getImageData(0, 0, w, h), `${w}×${h}`);
    URL.revokeObjectURL(url);
  };

  img.src = url;
}

// ── SLIDER WIRING ──────────────────────────────────────────────────────────────

/**
 * Synchronise each range slider with its adjacent label element.
 *
 * Sliders and their corresponding label ids:
 *  #winSlider  → #winLbl   (integer value)
 *  #kSlider    → #kLbl     (2 decimal places)
 *  #areaSlider → #areaLbl  (integer value)
 *
 * Called once from main.js during initialisation.
 */
export function initSliders() {
  $('winSlider').addEventListener('input', () => {
    $('winLbl').textContent = $('winSlider').value;
  });

  $('kSlider').addEventListener('input', () => {
    $('kLbl').textContent = parseFloat($('kSlider').value).toFixed(2);
  });

  $('areaSlider').addEventListener('input', () => {
    $('areaLbl').textContent = $('areaSlider').value;
  });
}

// ── DROP ZONE WIRING ───────────────────────────────────────────────────────────

/**
 * Attach drag-and-drop and click-to-browse event listeners to the drop zone.
 *
 * Events handled
 * ──────────────
 *  click     → programmatically trigger the hidden <input type="file">.
 *  dragover  → prevent default (allow drop) and add visual 'over' class.
 *  dragleave → remove the 'over' class.
 *  drop      → extract the first file from the DataTransfer and load it.
 *  change    → triggered by the file input; loads the chosen file.
 *
 * Only files whose MIME type starts with 'image/' are accepted.
 *
 * Called once from main.js during initialisation.
 */
export function initDropZone() {
  const dz = $('dropZone');

  dz.addEventListener('click', () => $('fileInput').click());

  dz.addEventListener('dragover', e => {
    e.preventDefault();
    dz.classList.add('over');
  });

  dz.addEventListener('dragleave', () => dz.classList.remove('over'));

  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) loadFile(f);
  });

  $('fileInput').addEventListener('change', e => {
    if (e.target.files[0]) loadFile(e.target.files[0]);
  });
}
