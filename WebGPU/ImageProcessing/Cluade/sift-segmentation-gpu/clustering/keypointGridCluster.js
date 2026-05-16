/**
 * clustering/keypointGridCluster.js – grid-based keypoint suppression.
 * Keeps at most `maxPerCell` highest-response keypoints per grid cell.
 */
export class KeypointGridCluster {
  #cfg;
  constructor(cfg) { this.#cfg = cfg; }

  cluster(keypoints, imageW, imageH) {
    const { gridCellSize: cs, maxKeypointsPerCell: max } = this.#cfg;
    const gridW  = Math.ceil(imageW / cs);
    const gridH  = Math.ceil(imageH / cs);
    const cells  = new Array(gridW * gridH).fill(null).map(() => []);

    for (const kp of keypoints) {
      const cx = Math.floor(kp.x / cs);
      const cy = Math.floor(kp.y / cs);
      const ci = cy * gridW + cx;
      cells[ci].push(kp);
    }

    const out = [];
    for (const cell of cells) {
      cell.sort((a, b) => b.response - a.response);
      for (let i = 0; i < Math.min(max, cell.length); i++) out.push(cell[i]);
    }
    return out;
  }
}
