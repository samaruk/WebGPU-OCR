// Math utilities

/** Clamp value between lo and hi */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Linear interpolation */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Round up to next power of 2 */
export function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** 2D index from x,y */
export const idx2 = (x, y, W) => y * W + x;

/** Build identity 3x3 matrix (row-major, flat Float32Array) */
export function identity3() {
  return new Float32Array([1,0,0, 0,1,0, 0,0,1]);
}

/** Matrix multiply 3x3 row-major */
export function matmul3(a, b) {
  const r = new Float32Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        r[i*3+j] += a[i*3+k] * b[k*3+j];
  return r;
}

/** Softmax over array (in-place) */
export function softmax(arr) {
  const maxV = Math.max(...arr);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) { arr[i] = Math.exp(arr[i] - maxV); sum += arr[i]; }
  for (let i = 0; i < arr.length; i++) arr[i] /= sum;
  return arr;
}
