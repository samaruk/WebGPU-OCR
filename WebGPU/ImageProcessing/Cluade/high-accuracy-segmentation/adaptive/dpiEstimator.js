/**
 * adaptive/dpiEstimator.js
 * Estimates effective DPI from the frequency content of the image.
 * Uses run-length analysis of horizontal foreground runs as a proxy for stroke width,
 * then maps that to DPI under a standard-text model.
 */
import { Config } from "../config.js";

/**
 * @param {GPUContext} gpuCtx
 * @param {ImageData} imageData
 * @param {object} qualityVector - from qualityScorer
 * @returns {number} estimated DPI
 */
export async function estimateDPI(gpuCtx, imageData, qualityVector) {
  const { data, width, height } = imageData;

  // Otsu threshold on grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const b = i * 4;
    gray[i] = Math.round(0.2126 * data[b] + 0.7152 * data[b + 1] + 0.0722 * data[b + 2]);
  }

  const hist = new Int32Array(256);
  for (const v of gray) hist[v]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, wF = 0, maxVar = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    wF = gray.length - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const bVar = wB * wF * (mB - mF) ** 2;
    if (bVar > maxVar) { maxVar = bVar; threshold = t; }
  }

  // Collect run lengths of foreground pixels on random horizontal lines
  const runLengths = [];
  const sampleLines = Math.min(200, height);
  const step = Math.max(1, Math.floor(height / sampleLines));
  for (let y = 0; y < height; y += step) {
    let run = 0, inRun = false;
    for (let x = 0; x < width; x++) {
      const fg = gray[y * width + x] < threshold;
      if (fg) { run++; inRun = true; }
      else if (inRun) { if (run >= 2 && run <= 50) runLengths.push(run); run = 0; inRun = false; }
    }
  }

  if (runLengths.length < 20) return Config.ASSUMED_DPI_FALLBACK;

  runLengths.sort((a, b) => a - b);
  const median = runLengths[Math.floor(runLengths.length * 0.3)]; // 30th pct ≈ stroke width

  // Standard text at 72dpi has ~5px stroke width; scale accordingly
  const dpi = Math.round((median / 5.0) * 72);
  return Math.max(Config.MIN_DPI, Math.min(Config.MAX_DPI, dpi));
}
