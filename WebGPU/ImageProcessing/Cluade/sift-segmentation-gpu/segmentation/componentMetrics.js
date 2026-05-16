/**
 * segmentation/componentMetrics.js – per-component shape / texture metrics.
 */
export class ComponentMetrics {
  /**
   * Compute per-component mean colour, variance and compactness.
   * @param {Int32Array} labels  – dense component label map
   * @param {Uint8Array} rgba    – original RGBA image
   * @param {object[]}   components
   * @param {number}     W
   */
  static compute(labels, rgba, components, W) {
    const stats = new Map(components.map(c => [c.id, { sumR:0, sumG:0, sumB:0, count:0 }]));
    for (let i = 0; i < labels.length; i++) {
      const id = labels[i]; if (id < 0) continue;
      const s  = stats.get(id); if (!s) continue;
      s.sumR += rgba[i*4]; s.sumG += rgba[i*4+1]; s.sumB += rgba[i*4+2]; s.count++;
    }
    return components.map(c => {
      const s = stats.get(c.id) ?? { sumR: 128, sumG: 128, sumB: 128, count: 1 };
      const n = s.count || 1;
      const bw = c.bbox[2] - c.bbox[0] + 1, bh = c.bbox[3] - c.bbox[1] + 1;
      const compactness = bw > 0 && bh > 0 ? c.area / (bw * bh) : 0;
      return { ...c,
        meanR: s.sumR / n, meanG: s.sumG / n, meanB: s.sumB / n,
        compactness,
      };
    });
  }
}
