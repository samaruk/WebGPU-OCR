/**
 * sift/descriptorExtract.js – computes 128-dim SIFT descriptors (CPU).
 */
import { OrientationAssign } from './orientationAssign.js';

export class DescriptorExtractor {
  #cfg;
  constructor(_, cfg) { this.#cfg = cfg; }

  async extract(pyrResult, keypoints) {
    const { descriptorBins = 8, descriptorHistBins = 8 } = this.#cfg;
    const withOri = OrientationAssign.assign(keypoints, pyrResult, this.#cfg);
    const numBins = descriptorBins; // spatial bins
    const numOri  = descriptorHistBins;

    return withOri.map(kp => {
      const octave = pyrResult.octaves[kp.octave];
      if (!octave) return { ...kp, descriptor: new Float32Array(128) };
      const { cpuData, width: W, height: H } = octave.scales[Math.min(kp.scale, octave.scales.length - 1)];
      const scaleO = 1 << kp.octave;
      const lx = kp.x / scaleO, ly = kp.y / scaleO;
      const sigma = kp.sigma;
      const halfW = numBins * 0.5 * 1.5 * sigma;
      const cos0  = Math.cos(kp.orientation);
      const sin0  = Math.sin(kp.orientation);
      const desc  = new Float32Array(numBins * numBins * numOri);

      const step = 2 * halfW / numBins;
      for (let dy = -Math.ceil(halfW); dy <= Math.ceil(halfW); dy++) {
        for (let dx = -Math.ceil(halfW); dx <= Math.ceil(halfW); dx++) {
          const rx =  cos0 * dx + sin0 * dy;
          const ry = -sin0 * dx + cos0 * dy;
          if (Math.abs(rx) > halfW || Math.abs(ry) > halfW) continue;
          const nx = Math.round(lx + dx);
          const ny = Math.round(ly + dy);
          if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;

          const gx = (cpuData[ny * W + nx + 1] - cpuData[ny * W + nx - 1]) / 255;
          const gy = (cpuData[(ny + 1) * W + nx] - cpuData[(ny - 1) * W + nx]) / 255;
          const mag = Math.hypot(gx, gy);
          let   ang = Math.atan2(gy, gx) - kp.orientation;
          while (ang < 0) ang += Math.PI * 2;
          while (ang >= Math.PI * 2) ang -= Math.PI * 2;

          const w     = Math.exp(-(rx * rx + ry * ry) / (2 * halfW * halfW));
          const bx    = (rx + halfW) / step;
          const by    = (ry + halfW) / step;
          const bo    = ang / (Math.PI * 2) * numOri;
          const bxi   = Math.floor(bx), byi = Math.floor(by), boi = Math.floor(bo);

          for (let dbi = 0; dbi <= 1; dbi++) for (let dbj = 0; dbj <= 1; dbj++) for (let dbk = 0; dbk <= 1; dbk++) {
            const bi = bxi + dbi, bj = byi + dbj, bk = (boi + dbk) % numOri;
            if (bi < 0 || bi >= numBins || bj < 0 || bj >= numBins) continue;
            const weight = mag * w * (1 - Math.abs(bx - bi)) * (1 - Math.abs(by - bj)) * (1 - Math.abs(bo - bk));
            desc[(bi * numBins + bj) * numOri + bk] += weight;
          }
        }
      }

      // Normalise
      let norm = 0; for (const v of desc) norm += v * v; norm = Math.sqrt(norm) + 1e-6;
      for (let i = 0; i < desc.length; i++) desc[i] = Math.min(desc[i] / norm, 0.2);
      norm = 0; for (const v of desc) norm += v * v; norm = Math.sqrt(norm) + 1e-6;
      for (let i = 0; i < desc.length; i++) desc[i] /= norm;

      return { ...kp, descriptor: desc };
    });
  }
}
