/**
 * segmentation/cca/localLabelPass.js – connected component analysis (CPU union-find).
 */
import { UnionFind } from './unionFind.js';

export class CCAPipeline {
  #ctx;
  constructor(ctx) { this.#ctx = ctx; }

  async run(maskTex, W, H) {
    // Read mask
    const raw  = await this.#ctx.textureManager.readback(maskTex, W, H);
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < mask.length; i++) mask[i] = raw[i * 4] > 127 ? 1 : 0;

    // Two-pass CCA
    const labels = new Int32Array(W * H).fill(-1);
    const uf     = new UnionFind(W * H);
    let nextLabel = 0;

    // First pass
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i]) continue;
        const up   = y > 0 && mask[(y-1)*W+x] ? labels[(y-1)*W+x] : -1;
        const left = x > 0 && mask[y*W+x-1]   ? labels[y*W+x-1]   : -1;
        if (up === -1 && left === -1) {
          labels[i] = nextLabel++;
        } else if (up !== -1 && left === -1) {
          labels[i] = up;
        } else if (left !== -1 && up === -1) {
          labels[i] = left;
        } else {
          labels[i] = Math.min(up, left);
          uf.union(up, left);
        }
      }
    }

    // Second pass
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] >= 0) labels[i] = uf.find(labels[i]);
    }

    // Gather component info
    const areas   = new Map();
    const minX    = new Map(), maxX = new Map(), minY = new Map(), maxY = new Map();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const l = labels[y * W + x];
        if (l < 0) continue;
        areas.set(l, (areas.get(l) ?? 0) + 1);
        minX.set(l, Math.min(minX.get(l) ?? x, x));
        maxX.set(l, Math.max(maxX.get(l) ?? x, x));
        minY.set(l, Math.min(minY.get(l) ?? y, y));
        maxY.set(l, Math.max(maxY.get(l) ?? y, y));
      }
    }

    const components = [];
    for (const [id, area] of areas) {
      components.push({
        id,
        area,
        bbox: [minX.get(id), minY.get(id), maxX.get(id), maxY.get(id)],
        cx: ((minX.get(id) + maxX.get(id)) / 2) | 0,
        cy: ((minY.get(id) + maxY.get(id)) / 2) | 0,
      });
    }

    return { labels, components, width: W, height: H };
  }
}
