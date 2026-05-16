/**
 * stroke/strokeWidthTransform.js – Stroke Width Transform (CPU).
 * Estimates uniform stroke width along gradient rays, used to detect text-like strokes.
 */
export class StrokeWidthTransform {
  /**
   * @param {Uint8Array} edgeMap  – binary edge map (>0 = edge)
   * @param {Float32Array} gradDir – per-pixel gradient direction in [-π, π]
   * @param {number} W
   * @param {number} H
   * @param {object} cfg
   */
  static run(edgeMap, gradDir, W, H, cfg = {}) {
    const { swtMinStroke = 1, swtMaxStroke = 20 } = cfg;
    const swt = new Float32Array(W * H).fill(Infinity);

    // Forward rays
    const rays = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!edgeMap[y * W + x]) continue;
        const theta = gradDir[y * W + x];
        const cos0  = Math.cos(theta), sin0 = Math.sin(theta);
        const ray   = [{ x, y }];
        for (let t = 1; t <= swtMaxStroke; t++) {
          const nx = Math.round(x + cos0 * t);
          const ny = Math.round(y + sin0 * t);
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
          ray.push({ x: nx, y: ny });
          if (edgeMap[ny * W + nx]) {
            const oppTheta = gradDir[ny * W + nx];
            const angleDiff = Math.abs(Math.PI - Math.abs(theta - oppTheta));
            if (angleDiff < Math.PI / 6) {
              const width = t;
              if (width >= swtMinStroke) {
                for (const pt of ray) {
                  swt[pt.y * W + pt.x] = Math.min(swt[pt.y * W + pt.x], width);
                }
              }
            }
            rays.push(ray.map(p => ({ ...p, width: t })));
            break;
          }
        }
      }
    }

    // Median pass: set each ray pixel to the median SWT of that ray
    for (const ray of rays) {
      const vals = ray.map(p => swt[p.y * W + p.x]).filter(v => v < Infinity);
      if (!vals.length) continue;
      vals.sort((a, b) => a - b);
      const med = vals[Math.floor(vals.length / 2)];
      for (const p of ray) { if (swt[p.y * W + p.x] < Infinity) swt[p.y * W + p.x] = med; }
    }

    // Replace Infinity with 0
    for (let i = 0; i < swt.length; i++) if (!isFinite(swt[i])) swt[i] = 0;
    return swt;
  }
}
