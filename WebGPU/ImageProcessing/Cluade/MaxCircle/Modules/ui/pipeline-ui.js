/**
 * ui/pipeline-ui.js
 * Controls the visual state of the pipeline stage indicator in the sidebar.
 *
 * States:
 *   idle    → no class
 *   active  → amber highlight (currently running)
 *   done    → green (completed)
 */

const STAGE_COUNT = 6;  // ps0 … ps5

/**
 * Highlight one pipeline stage as active; mark all prior stages as done.
 * @param {number} index — 0-based stage index
 */
export function setStage(index) {
  for (let k = 0; k < STAGE_COUNT; k++) {
    const el = document.getElementById(`ps${k}`);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if      (k < index)  el.classList.add('done');
    else if (k === index) el.classList.add('active');
  }
}

/** Mark every stage as done (pipeline complete). */
export function allDone() {
  for (let k = 0; k < STAGE_COUNT; k++) {
    const el = document.getElementById(`ps${k}`);
    if (!el) continue;
    el.classList.remove('active');
    el.classList.add('done');
  }
}

/** Reset all stages to idle. */
export function resetStages() {
  for (let k = 0; k < STAGE_COUNT; k++) {
    const el = document.getElementById(`ps${k}`);
    if (!el) continue;
    el.classList.remove('active', 'done');
  }
}

/**
 * Update the device info text and FP16 badge after GPU init.
 * @param {string}  devName
 * @param {boolean} fp16
 */
export function updateDeviceUI(devName, fp16) {
  const devEl = document.getElementById('statDev');
  if (devEl) devEl.textContent = devName;

  const fp16Val = document.getElementById('svFP16');
  if (fp16Val) {
    fp16Val.textContent = fp16 ? '2× SPEED (f16)' : 'OFF (f32)';
    fp16Val.className   = 'sv ' + (fp16 ? 'g' : 'r');
  }

  const fp16Tag = document.getElementById('fp16Tag');
  if (fp16Tag && fp16) fp16Tag.classList.add('on');

  const subFP = document.getElementById('subFP');
  if (subFP) subFP.textContent = fp16 ? 'f16 ×2' : 'f32';
}

/**
 * Update resolution + JFA-pass count labels.
 * @param {number} W
 * @param {number} H
 */
export function updateResUI(W, H) {
  const res = document.getElementById('svRes');
  if (res) res.textContent = `${W}×${H}`;

  const jN   = Math.ceil(Math.log2(Math.max(W, H)));
  const jEl  = document.getElementById('svJFA');
  const jSub = document.getElementById('subJFA');
  if (jEl)  jEl.textContent  = String(jN);
  if (jSub) jSub.textContent = `×${jN}`;
}

/**
 * Show the timing result and animate the progress bar.
 * @param {number} ms
 */
export function showTiming(ms) {
  const el = document.getElementById('svTime');
  if (el) el.textContent = `${ms.toFixed(1)} ms`;

  const fill = document.getElementById('tfill');
  if (fill) fill.style.width = Math.min(100, (ms / 300) * 100) + '%';
}

/**
 * Show the circle result panel.
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 */
export function showResult(cx, cy, radius) {
  const box = document.getElementById('rbox');
  if (box) box.classList.add('show');

  const lines = document.getElementById('rlines');
  if (lines) {
    lines.innerHTML =
      `CX = ${cx} px<br>` +
      `CY = ${cy} px<br>` +
      `R&nbsp; = ${radius.toFixed(2)} px<br>` +
      `D&nbsp; = ${(radius * 2).toFixed(2)} px`;
  }
}
