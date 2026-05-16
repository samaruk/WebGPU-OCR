/**
 * sift/extremaDetection.js – CPU 3×3×3 extrema detection in DoG stack.
 */
import { DoGBuilder } from './dog.js';
import { HessianReject } from './hessianReject.js';

export class SIFTDetector {
  #cfg;
  constructor(_, cfg) { this.#cfg = cfg; }

  async detect(pyrResult) {
    const { contrastThreshold, edgeThreshold, maxKeypointsPerOctave } = this.#cfg;
    const dogStack = DoGBuilder.build(pyrResult);
    const keypoints = [];

    dogStack.octaves.forEach((octave, oi) => {
      const { dogs, width: W, height: H } = octave;
      const S = pyrResult.octaves[oi].scales;
      const scale = 1 << oi;
      let count = 0;

      for (let s = 1; s < dogs.length - 1; s++) {
        const prev = dogs[s - 1], curr = dogs[s], next = dogs[s + 1];

        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const v = curr[y * W + x];
            if (Math.abs(v) < contrastThreshold * 0.5) continue;

            // 3×3×3 neighbourhood check
            let isMin = true, isMax = true;
            outer: for (let ds = -1; ds <= 1; ds++) {
              const dog = ds === -1 ? prev : ds === 0 ? curr : next;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (ds === 0 && dy === 0 && dx === 0) continue;
                  const nb = dog[(y + dy) * W + (x + dx)];
                  if (nb >= v) isMax = false;
                  if (nb <= v) isMin = false;
                  if (!isMax && !isMin) break outer;
                }
              }
            }
            if (!isMax && !isMin) continue;

            // Edge rejection via Hessian ratio
            if (HessianReject.reject(curr, x, y, W, edgeThreshold)) continue;

            keypoints.push({
              x: x * scale, y: y * scale,
              octave: oi, scale: s,
              sigma: S[s].sigma,
              response: Math.abs(v),
              orientation: 0,
              descriptor: null,
            });
            if (++count >= maxKeypointsPerOctave) return;
          }
        }
      }
    });

    return keypoints;
  }
}
