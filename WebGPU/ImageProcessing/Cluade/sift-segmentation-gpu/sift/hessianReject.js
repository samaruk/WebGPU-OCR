/**
 * sift/hessianReject.js – rejects edge-like keypoints using the Hessian matrix trace/det ratio.
 */
export class HessianReject {
  /**
   * Returns true if the keypoint at (x,y) in dog should be rejected as an edge response.
   */
  static reject(dog, x, y, W, edgeThresh = 10) {
    const idx = (dy, dx) => dog[(y + dy) * W + (x + dx)];
    const dxx = idx(0, 1) - 2 * idx(0, 0) + idx(0, -1);
    const dyy = idx(1, 0) - 2 * idx(0, 0) + idx(-1, 0);
    const dxy = (idx(1, 1) - idx(1, -1) - idx(-1, 1) + idx(-1, -1)) * 0.25;
    const trH  = dxx + dyy;
    const detH = dxx * dyy - dxy * dxy;
    if (detH <= 0) return true;
    const r = edgeThresh;
    return (trH * trH / detH) > ((r + 1) * (r + 1) / r);
  }
}
