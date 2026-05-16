/**
 * adaptive/qualityScorer.js
 * Computes image quality metrics: blur, noise, contrast, illumination variance, bleedthrough energy.
 * Returns a quality vector consumed by paramResolver and stageGating.
 */
import { Config } from "../config.js";

/**
 * @param {GPUContext} gpuCtx
 * @param {ImageData} imageData - Raw input image
 * @returns {object} qualityVector
 */
export async function computeQualityScore(gpuCtx, imageData) {
  const { data, width, height } = imageData;
  const N = width * height;

  // ── Convert to grayscale on CPU (small overhead, avoids extra GPU pipeline) ──
  const gray = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const base = i * 4;
    gray[i] = 0.2126 * data[base] / 255 + 0.7152 * data[base + 1] / 255 + 0.0722 * data[base + 2] / 255;
  }

  // ── Blur score: Laplacian variance ───────────────────────────────────────────
  let lapVar = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap = -gray[idx - width] - gray[idx - 1] + 4 * gray[idx] - gray[idx + 1] - gray[idx + width];
      lapVar += lap * lap;
    }
  }
  const blurScore = lapVar / ((width - 2) * (height - 2));

  // ── Contrast: Michelson contrast in 8x8 blocks ───────────────────────────────
  const blockSize = 8;
  let contrastSum = 0, blockCount = 0;
  for (let by = 0; by < height - blockSize; by += blockSize) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize) {
      let lo = 1, hi = 0;
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const v = gray[(by + dy) * width + (bx + dx)];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      if (hi + lo > 0.01) { contrastSum += (hi - lo) / (hi + lo); blockCount++; }
    }
  }
  const contrastRatio = blockCount > 0 ? contrastSum / blockCount : 0.5;

  // ── Noise: high-frequency energy ratio ──────────────────────────────────────
  let noiseSum = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const diff = Math.abs(gray[idx] - gray[idx + 1]) + Math.abs(gray[idx] - gray[idx + width]);
      noiseSum += diff;
    }
  }
  const noiseRatio = noiseSum / ((width - 1) * (height - 1) * 0.5);

  // ── Illumination variance: mean of local brightness std-dev ─────────────────
  let illumVar = 0, illumCount = 0;
  const bs = 32;
  for (let by = 0; by < height - bs; by += bs) {
    for (let bx = 0; bx < width - bs; bx += bs) {
      let mean = 0;
      for (let dy = 0; dy < bs; dy++) for (let dx = 0; dx < bs; dx++) mean += gray[(by + dy) * width + (bx + dx)];
      mean /= bs * bs;
      illumVar += Math.abs(mean - 0.5);
      illumCount++;
    }
  }
  const illuminationVariance = illumCount > 0 ? illumVar / illumCount : 0;

  // ── Bleedthrough energy: difference between top/bottom halves ────────────────
  let topMean = 0, bottomMean = 0;
  const halfH = Math.floor(height / 2);
  for (let y = 0; y < halfH; y++) for (let x = 0; x < width; x++) topMean    += gray[y * width + x];
  for (let y = halfH; y < height; y++) for (let x = 0; x < width; x++) bottomMean += gray[y * width + x];
  topMean    /= halfH * width;
  bottomMean /= (height - halfH) * width;
  const bleedthroughEnergy = Math.abs(topMean - bottomMean);

  return { blurScore, contrastRatio, noiseRatio, illuminationVariance, bleedthroughEnergy };
}
