/**
 * stages/16_shapeFilter/shapeFilter.js
 * Scale-invariant shape filtering using stroke-width normalized metrics.
 * Removes noise, artifacts, and non-character regions.
 */
import { runConvexityScore } from "./convexityScore.js";
import { adaptiveHeuristics } from "../../adaptive/adaptiveHeuristics.js";

export async function runShapeFilter(gpuCtx, mergedLabels, sws, params, registry) {
  const { labelTex, componentCount } = mergedLabels;
  const { device } = gpuCtx;
  const W = labelTex.width, H = labelTex.height;
  const msw = sws.get(8);

  const imgData = await gpuCtx.downloadToImageData(labelTex);
  const labels  = new Uint32Array(W * H);
  for (let i = 0; i < W * H; i++) labels[i] = imgData.data[i * 4];

  const components = buildComponentData(labels, W, H);
  const rejected   = new Set();

  const minArea    = params.shapeAreaMinFactor * msw * msw;
  const maxArea    = params.shapeAreaMaxFactor * msw * msw;
  const minAspect  = params.shapeAspectMin;
  const maxAspect  = params.shapeAspectMax;
  const minConvex  = params.shapeConvexityMin;

  for (const [id, comp] of components) {
    const w = comp.x2 - comp.x1 + 1;
    const h = comp.y2 - comp.y1 + 1;
    const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
    const area   = comp.pixelCount;
    const normArea = area / (msw * msw);

    // Area check (normalized)
    if (normArea < params.shapeAreaMinFactor || normArea > params.shapeAreaMaxFactor) {
      rejected.add(id); continue;
    }
    // Aspect ratio
    if (aspect < minAspect || aspect > maxAspect) { rejected.add(id); continue; }
    // Convexity (from separate module)
    const convexity = computeSimpleConvexity(comp);
    if (convexity < minConvex) { rejected.add(id); continue; }
    // Euler number (hole count)
    if (comp.holeEstimate > params.shapeEulerMaxHoles) { rejected.add(id); continue; }
  }

  // Remap — zero out rejected labels
  const outLabels = labels.map(id => rejected.has(id) ? 0 : id);
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < outLabels.length; i++) {
    rgba[i*4] = outLabels[i]&0xFF; rgba[i*4+1]=(outLabels[i]>>8)&0xFF;
    rgba[i*4+2]=(outLabels[i]>>16)&0xFF; rgba[i*4+3]=255;
  }
  const newTex = await gpuCtx.uploadImageData(new ImageData(rgba, W, H));
  return { labelTex: newTex, componentCount: componentCount - rejected.size };
}

function buildComponentData(labels, W, H) {
  const map = new Map();
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i]; if (!id) continue;
    const x = i % W, y = Math.floor(i / W);
    if (!map.has(id)) map.set(id, {x1:x,y1:y,x2:x,y2:y,pixelCount:0,holeEstimate:0});
    const c = map.get(id);
    c.x1=Math.min(c.x1,x); c.y1=Math.min(c.y1,y);
    c.x2=Math.max(c.x2,x); c.y2=Math.max(c.y2,y);
    c.pixelCount++;
  }
  return map;
}

function computeSimpleConvexity(comp) {
  const area = comp.pixelCount;
  const bboxArea = (comp.x2 - comp.x1 + 1) * (comp.y2 - comp.y1 + 1);
  return bboxArea > 0 ? Math.min(1, area / bboxArea) : 0;
}
