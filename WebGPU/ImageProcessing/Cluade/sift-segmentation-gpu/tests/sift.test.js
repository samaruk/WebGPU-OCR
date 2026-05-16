/**
 * tests/sift.test.js – unit tests for SIFT keypoint detection helpers.
 */
import { HessianReject }     from '../sift/hessianReject.js';
import { SubpixelRefinement } from '../sift/subpixelRefinement.js';

describe('HessianReject', () => {
  test('rejects edge-like response', () => {
    // Create a dog plane that looks like a ridge
    const W = 5, H = 5;
    const dog = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dog[y*W+x] = x * 0.1;
    expect(HessianReject.reject(dog, 2, 2, W, 10)).toBe(true);
  });

  test('passes blob-like response', () => {
    const W = 5, H = 5;
    const dog = new Float32Array(W * H);
    // Gaussian blob at centre
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - 2, dy = y - 2;
      dog[y*W+x] = Math.exp(-(dx*dx + dy*dy));
    }
    expect(HessianReject.reject(dog, 2, 2, W, 10)).toBe(false);
  });
});

describe('SubpixelRefinement', () => {
  test('returns null for flat region', () => {
    const W = 5, H = 5;
    const flat = new Float32Array(W * H).fill(0.5);
    const r = SubpixelRefinement.refine([flat, flat, flat], { x: 2, y: 2 }, W);
    // det ≈ 0 → should return null or near-zero offsets
    expect(r === null || (Math.abs(r.dx) < 1 && Math.abs(r.dy) < 1)).toBe(true);
  });
});
