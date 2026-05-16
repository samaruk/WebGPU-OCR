// stages/01_uploadTexture.js

import { imageDataToTexture } from '../core/utils.js';

export async function uploadTexture(ctx, bm, imageData) {
  const { width: w, height: h } = imageData;
  const tex = imageDataToTexture(ctx.device, imageData);
  bm.setTexture('source', tex);
  bm.setTexture('width', { value: w });   // pseudo-entry for metadata
  bm.setTexture('height', { value: h });
  return { width: w, height: h };
}
