/**
 * sift/subpixelRefinement.js – Taylor-series sub-pixel localisation of DoG extrema.
 */
export class SubpixelRefinement {
  /**
   * Refine keypoint position using quadratic interpolation.
   * @param {Float32Array[]} dogs  – [prev, curr, next] DoG planes
   * @param {{ x, y }} kp
   * @param {number} W
   * @returns {{ dx, dy, ds, response }}
   */
  static refine(dogs, kp, W) {
    const [prev, curr, next] = dogs;
    const { x, y } = kp;
    const at = (dog, dx, dy) => dog[(y + dy) * W + (x + dx)];

    // First derivatives
    const dx = (at(curr, 1, 0) - at(curr, -1, 0)) * 0.5;
    const dy = (at(curr, 0, 1) - at(curr, 0, -1)) * 0.5;
    const ds = (at(next, 0, 0) - at(prev, 0, 0)) * 0.5;

    // Second derivatives
    const c   = at(curr, 0, 0);
    const dxx = at(curr, 1, 0) - 2 * c + at(curr, -1, 0);
    const dyy = at(curr, 0, 1) - 2 * c + at(curr, 0, -1);
    const dss = at(next, 0, 0) - 2 * c + at(prev, 0, 0);
    const dxy = (at(curr, 1, 1) - at(curr, -1, 1) - at(curr, 1, -1) + at(curr, -1, -1)) * 0.25;
    const dxs = (at(next, 1, 0) - at(next, -1, 0) - at(prev, 1, 0) + at(prev, -1, 0)) * 0.25;
    const dys = (at(next, 0, 1) - at(next, 0, -1) - at(prev, 0, 1) + at(prev, 0, -1)) * 0.25;

    // 3×3 Hessian solve (Cramer)
    const H = [[dxx, dxy, dxs], [dxy, dyy, dys], [dxs, dys, dss]];
    const b = [-dx, -dy, -ds];
    const det = det3(H);
    if (Math.abs(det) < 1e-10) return null;

    return {
      dx: cramer(H, b, 0) / det,
      dy: cramer(H, b, 1) / det,
      ds: cramer(H, b, 2) / det,
      response: c + 0.5 * (dx * (-b[0] / det) + dy * (-b[1] / det) + ds * (-b[2] / det)),
    };
  }
}

function det3([[a,b,c],[d,e,f],[g,h,i]]) {
  return a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g);
}
function cramer(H, b, col) {
  const m = H.map(r => [...r]);
  m[0][col] = b[0]; m[1][col] = b[1]; m[2][col] = b[2];
  return det3(m);
}
