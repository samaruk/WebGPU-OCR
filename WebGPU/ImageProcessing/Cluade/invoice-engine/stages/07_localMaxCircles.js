// stages/07_localMaxCircles.js
// Read distance field from GPU, find local maxima on CPU (fast enough for typical invoice sizes)

import { readTexture } from '../core/utils.js';
import { CONFIG } from '../config.js';

export async function localMaxCircles(ctx, bm, w, h) {
  const distTex = bm.getTexture('distance');
  const raw = await readTexture(ctx.device, distTex, w, h, 4); // r32float → 4 bytes/pixel
  const dist = new Float32Array(raw.buffer);

  const {
    localWindowRadius: wr,
    minRadius,
    maxRadiusRatio,
    scoreThreshold,
    maxCircles,
  } = CONFIG.circles;

  const maxRadius = Math.min(w, h) * maxRadiusRatio;

  // Normalize distance field to 0-1
  let globalMax = 0;
  for (let i = 0; i < dist.length; i++) globalMax = Math.max(globalMax, dist[i]);
  if (globalMax === 0) return [];

  const circles = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const d = dist[idx];
      if (d < minRadius) continue;
      if (d > maxRadius) continue;
      if (d / globalMax < scoreThreshold) continue;

      // Check local maximum in window
      let isMax = true;
      const r = wr;
      outer: for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (dist[ny * w + nx] > d) { isMax = false; break outer; }
        }
      }

      if (isMax) {
        circles.push({ x, y, r: d, score: d / globalMax });
        if (circles.length >= maxCircles) { y = h; break; }
      }
    }
  }

  // Sort by score descending
  circles.sort((a, b) => b.score - a.score);

  return circles;
}
