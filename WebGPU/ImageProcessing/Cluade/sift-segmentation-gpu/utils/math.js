/**
 * utils/math.js – shared math helpers.
 */
export const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp   = (a, b, t)   => a + (b - a) * t;
export const norm2  = arr => { let s = 0; for (const v of arr) s += v*v; return Math.sqrt(s); };
export const dot    = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]*b[i]; return s; };
export const radToDeg = r => r * 180 / Math.PI;
export const degToRad = d => d * Math.PI / 180;
export const gaussian = (x, sigma) => Math.exp(-x * x / (2 * sigma * sigma));

/** 2×2 matrix determinant */
export const det2 = (a, b, c, d) => a * d - b * c;

/** Build a 1-D Gaussian kernel (normalised). */
export function gaussKernel1D(sigma) {
  const r   = Math.ceil(3 * sigma);
  const k   = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}
