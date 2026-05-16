/**
 * stages/14_splitDetector/splitDetector.js
 * Orchestrates all 5 split detection criteria.
 * Emits MERGE_CANDIDATE with confidence score per adjacent component pair.
 */
import { computeStrokeWidthContinuity }  from "./strokeWidthContinuity.js";
import { computeSkeletonAngleContinuity } from "./skeletonAngleContinuity.js";
import { computeBoundaryEnergy }          from "./boundaryEnergy.js";
import { computeCompactnessTest }         from "./compactnessTest.js";
import { computeEulerCheck }              from "./eulerCheck.js";

export async function runSplitDetector(gpuCtx, mergedLabels, binaryTex, swtMap, sws, params, registry) {
  const { labelTex, componentCount } = mergedLabels;
  const decisions = new Map();
  if (componentCount < 2) return decisions;

  const W = labelTex.width, H = labelTex.height;
  const imgData = await gpuCtx.downloadToImageData(labelTex);
  const labels  = extractLabelChannel(imgData, W * H);
  const components   = buildComponentData(labels, W, H, componentCount);
  const adjacentPairs = findAdjacentPairs(labels, W, H, components);

  for (const [key, pair] of adjacentPairs) {
    const compA = components.get(pair.a);
    const compB = components.get(pair.b);
    if (!compA || !compB) continue;

    const swScore     = await computeStrokeWidthContinuity(gpuCtx, swtMap, compA, compB, sws, params);
    const skelScore   = await computeSkeletonAngleContinuity(gpuCtx, binaryTex, compA, compB, params);
    const energyScore = await computeBoundaryEnergy(gpuCtx, binaryTex, compA, compB, params);
    const compScore   = await computeCompactnessTest(compA, compB);
    const eulerScore  = await computeEulerCheck(gpuCtx, binaryTex, compA, compB);

    // Weighted confidence: higher = more confident this is a MERGE_CANDIDATE
    const weights = [0.25, 0.25, 0.20, 0.15, 0.15];
    const scores  = [swScore, skelScore, energyScore, compScore, eulerScore];
    const confidence = scores.reduce((s, v, i) => s + v * weights[i], 0);
    const merge = confidence >= params.splitConfidenceGate;

    decisions.set(key, { confidence, merge, scores });
  }

  return decisions;
}

function extractLabelChannel(imgData, N) {
  const out = new Uint32Array(N);
  for (let i = 0; i < N; i++) out[i] = imgData.data[i * 4];
  return out;
}

function buildComponentData(labels, W, H, count) {
  const map = new Map();
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i];
    if (!id) continue;
    const x = i % W, y = Math.floor(i / W);
    if (!map.has(id)) map.set(id, { id, x1: x, y1: y, x2: x, y2: y, pixels: [] });
    const c = map.get(id);
    if (x < c.x1) c.x1 = x; if (y < c.y1) c.y1 = y;
    if (x > c.x2) c.x2 = x; if (y > c.y2) c.y2 = y;
    if (c.pixels.length < 500) c.pixels.push([x, y]); // sample
  }
  return map;
}

function findAdjacentPairs(labels, W, H, components) {
  const pairs = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = labels[y * W + x];
      if (!a) continue;
      const nb = [
        x + 1 < W ? labels[y * W + x + 1] : 0,
        y + 1 < H ? labels[(y + 1) * W + x] : 0,
      ];
      for (const b of nb) {
        if (b && b !== a) {
          const key = `${Math.min(a,b)}:${Math.max(a,b)}`;
          if (!pairs.has(key)) pairs.set(key, { a: Math.min(a,b), b: Math.max(a,b) });
        }
      }
    }
  }
  return pairs;
}
