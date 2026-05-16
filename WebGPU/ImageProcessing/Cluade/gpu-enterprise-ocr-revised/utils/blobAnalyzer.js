
import { readbackBuffer } from './debugReadback.js';
import { CONFIG }         from '../config.js';

/**
 * Reads back the CCL labels buffer and computes per-blob statistics.
 * Returns { needsTouchingStages: bool, blobCount: int, maxAspect: float }
 *
 * Touching-character stages (watershed, projection, skeleton, resegment)
 * are only needed when blobs appear merged (large aspect ratio).
 */
export async function analyzeBlobsForConditionalStages(device, labelsBuffer, width, height) {
  const labels = await readbackBuffer(device, labelsBuffer, width * height);

  // Accumulate bounding boxes per label
  const minX = new Map(), maxX = new Map(), minY = new Map(), maxY = new Map();
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (!l) continue;
    const x = i % width, y = Math.floor(i / width);
    if (!minX.has(l)) { minX.set(l,x); maxX.set(l,x); minY.set(l,y); maxY.set(l,y); }
    else {
      if (x < minX.get(l)) minX.set(l,x);
      if (x > maxX.get(l)) maxX.set(l,x);
      if (y < minY.get(l)) minY.set(l,y);
      if (y > maxY.get(l)) maxY.set(l,y);
    }
  }

  const { touchingAspectRatio, minBlobSize } = CONFIG.conditional;
  let maxAspect = 0, blobCount = 0;

  for (const l of minX.keys()) {
    const w = maxX.get(l) - minX.get(l) + 1;
    const h = maxY.get(l) - minY.get(l) + 1;
    const area = w * h;
    if (area < minBlobSize) continue;
    blobCount++;
    const aspect = Math.max(w/h, h/w);
    if (aspect > maxAspect) maxAspect = aspect;
  }

  const needsTouchingStages = maxAspect > touchingAspectRatio;
  return { needsTouchingStages, blobCount, maxAspect: maxAspect.toFixed(2) };
}
