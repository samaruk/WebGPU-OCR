/**
 * shaders/dist.js
 * WGSL source factory for Stage 3 — Distance Field computation.
 *
 * Algorithm:
 *   For every pixel, reads its nearest background seed coordinate (from JFA),
 *   computes true Euclidean distance √(dx²+dy²), and writes it to distBuf.
 *
 * FP16 mode (fp16 = true):
 *   Enables `shader-f16` extension and uses array<f16> for distBuf.
 *   This halves the buffer's memory footprint → 2× memory bandwidth.
 *
 * Workgroup size: 64 threads (1-D dispatch over all pixels).
 * Bindings:
 *   0 → seedBuf : array<vec2u>      (nearest-seed coords from JFA)
 *   1 → distBuf : array<f32|f16>   (output distances)
 *   2 → dims    : vec2u             (uniform: width, height)
 *
 * @param {boolean} fp16 — true to emit f16 variant
 * @returns {string} WGSL source
 */
export function wgslDist(fp16) {
  const T  = fp16 ? 'f16' : 'f32';
  const en = fp16 ? 'enable f16;\n' : '';

  return /* wgsl */`${en}
@group(0) @binding(0) var<storage, read>       seedBuf : array<vec2u>;
@group(0) @binding(1) var<storage, read_write> distBuf : array<${T}>;
@group(0) @binding(2) var<uniform>             dims    : vec2u;

const INV : u32 = 0xFFFFFFFFu;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) g : vec3u) {
  let idx = g.x;
  if (idx >= dims.x * dims.y) { return; }

  let seed = seedBuf[idx];

  // Pixel is inside foreground but has no reachable background seed
  if (seed.x == INV) { distBuf[idx] = ${T}(0.0); return; }

  let px = f32(idx % dims.x);
  let py = f32(idx / dims.x);
  let dx = px - f32(seed.x);
  let dy = py - f32(seed.y);

  distBuf[idx] = ${T}(sqrt(dx * dx + dy * dy));
}
`;
}
