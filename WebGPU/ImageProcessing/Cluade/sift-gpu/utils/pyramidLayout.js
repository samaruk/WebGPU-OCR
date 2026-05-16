// ============================================================
// SIFT-GPU  –  Pyramid Layout Utilities
// ============================================================
import { CONFIG, autoOctaves } from '../config.js';

export function buildPyramidLayout(imgWidth, imgHeight, numOctaves = CONFIG.numOctaves) {
  const nOct = numOctaves || autoOctaves(imgWidth, imgHeight);
  const S    = CONFIG.scalesPerOctave;
  const layout = [];
  let w = imgWidth, h = imgHeight;
  for (let o = 0; o < nOct; o++) {
    layout.push({ octave: o, width: w, height: h, numLevels: S + 3, numDog: S + 2 });
    w = Math.max(1, Math.floor(w / 2));
    h = Math.max(1, Math.floor(h / 2));
  }
  return layout;
}

export function totalGaussianLayers(layout) {
  return layout.reduce((acc, o) => acc + o.numLevels, 0);
}
export function totalDogLayers(layout) {
  return layout.reduce((acc, o) => acc + o.numDog, 0);
}
export function gaussianLayerIndex(layout, octave, scaleIdx) {
  let base = 0;
  for (let o = 0; o < octave; o++) base += layout[o].numLevels;
  return base + scaleIdx;
}
export function dogLayerIndex(layout, octave, dogIdx) {
  let base = 0;
  for (let o = 0; o < octave; o++) base += layout[o].numDog;
  return base + dogIdx;
}
export function toImageCoords(octave, subX, subY) {
  const s = Math.pow(2, octave);
  return { x: subX * s, y: subY * s };
}
export function absoluteSigma(octave, scaleIdx,
  S = CONFIG.scalesPerOctave, sigma0 = CONFIG.sigma0) {
  return sigma0 * Math.pow(Math.pow(2, 1/S), scaleIdx) * Math.pow(2, octave);
}
export function logPyramidLayout(layout) {
  console.group('[SIFT-GPU] Scale-space pyramid');
  layout.forEach(({ octave, width, height, numLevels, numDog }) =>
    console.log(`Octave ${octave}: ${width}x${height}  levels=${numLevels}  DoG=${numDog}`)
  );
  console.groupEnd();
}
