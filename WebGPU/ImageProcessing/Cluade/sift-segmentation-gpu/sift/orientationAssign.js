/**
 * sift/orientationAssign.js – assign dominant orientation(s) to each keypoint.
 */
export class OrientationAssign {
  /**
   * @param {object[]} keypoints
   * @param {object}   pyrResult
   * @param {object}   cfg
   * @returns {object[]} keypoints with .orientation assigned (may clone for multi-peak)
   */
  static assign(keypoints, pyrResult, cfg) {
    const { orientationBins = 36, orientationPeak = 0.8 } = cfg;
    const TWO_PI = Math.PI * 2;
    const out    = [];

    keypoints.forEach(kp => {
      const octave = pyrResult.octaves[kp.octave];
      if (!octave) { out.push({ ...kp }); return; }
      const { cpuData, width: W, height: H } = octave.scales[kp.scale] ?? octave.scales[0];
      const sigma = kp.sigma;
      const r     = Math.round(3 * sigma);
      const hist  = new Float32Array(orientationBins);

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = Math.round(kp.x / (1 << kp.octave)) + dx;
          const ny = Math.round(kp.y / (1 << kp.octave)) + dy;
          if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
          const gx = (cpuData[ny * W + nx + 1] - cpuData[ny * W + nx - 1]) / 255;
          const gy = (cpuData[(ny + 1) * W + nx] - cpuData[(ny - 1) * W + nx]) / 255;
          const mag  = Math.hypot(gx, gy);
          const ang  = Math.atan2(gy, gx);
          const w    = Math.exp(-(dx * dx + dy * dy) / (2 * (1.5 * sigma) ** 2));
          const bin  = Math.floor(((ang + Math.PI) / TWO_PI) * orientationBins) % orientationBins;
          hist[bin] += mag * w;
        }
      }

      // Smooth histogram
      const smooth = new Float32Array(orientationBins);
      for (let b = 0; b < orientationBins; b++) {
        smooth[b] = (hist[(b - 1 + orientationBins) % orientationBins] + hist[b] * 6 + hist[(b + 1) % orientationBins]) / 8;
      }

      const maxVal = Math.max(...smooth);
      const thresh = maxVal * orientationPeak;

      for (let b = 0; b < orientationBins; b++) {
        const prev = smooth[(b - 1 + orientationBins) % orientationBins];
        const next = smooth[(b + 1) % orientationBins];
        if (smooth[b] > thresh && smooth[b] > prev && smooth[b] > next) {
          // Parabolic interpolation for peak
          const frac = 0.5 * (prev - next) / (prev - 2 * smooth[b] + next + 1e-10);
          const ang  = ((b + frac) / orientationBins) * TWO_PI - Math.PI;
          out.push({ ...kp, orientation: ang });
        }
      }
      if (!out.length || out[out.length - 1] !== kp) out.push({ ...kp, orientation: 0 });
    });

    return out;
  }
}
