/**
 * workers/cpuRefinement.worker.js
 * Offloads CPU-heavy sub-pixel refinement and orientation assignment to a Worker thread.
 */
import { SubpixelRefinement } from '../sift/subpixelRefinement.js';

self.onmessage = function ({ data }) {
  const { type } = data;
  if (type === 'refine') {
    const { dogs, keypoints, W, contrastThreshold } = data;
    const refined = [];
    for (const kp of keypoints) {
      const s = kp.scale;
      if (s < 1 || s >= dogs.length - 1) { refined.push(kp); continue; }
      const r = SubpixelRefinement.refine([dogs[s-1], dogs[s], dogs[s+1]], kp, W);
      if (!r || Math.abs(r.response) < contrastThreshold) continue;
      if (Math.abs(r.dx) > 0.5 || Math.abs(r.dy) > 0.5) continue;
      refined.push({ ...kp, x: kp.x + r.dx, y: kp.y + r.dy, response: r.response });
    }
    self.postMessage({ type: 'refined', keypoints: refined });
  }
};
