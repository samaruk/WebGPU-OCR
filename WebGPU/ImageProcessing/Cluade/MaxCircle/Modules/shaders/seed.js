/**
 * shaders/seed.js
 * WGSL source for Stage 1 — Seed Initialisation.
 *
 * Algorithm:
 *   Background pixels (luminance < 0.5) become seeds at their own (x, y).
 *   Foreground pixels (luminance ≥ 0.5) are marked INVALID (0xFFFFFFFF).
 *
 * Workgroup size: 8×8 threads.
 * Bindings:
 *   0 → binaryTex : texture_2d<f32>   (r8unorm, white=foreground)
 *   1 → seedBuf   : array<vec2u>      (output nearest-seed coords per pixel)
 *   2 → dims      : vec2u             (uniform: width, height)
 */
export const WGSL_SEED = /* wgsl */`
@group(0) @binding(0) var binaryTex : texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> seedBuf : array<vec2u>;
@group(0) @binding(2) var<uniform> dims : vec2u;

const INV : u32 = 0xFFFFFFFFu;   // sentinel for "no seed"

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) g : vec3u) {
  if (g.x >= dims.x || g.y >= dims.y) { return; }

  let idx = g.y * dims.x + g.x;
  let v   = textureLoad(binaryTex, vec2i(g.xy), 0).r;

  // white (>=0.5) = foreground → needs nearest background seed
  // black (< 0.5) = background → is itself a seed
  seedBuf[idx] = select(vec2u(INV, INV), vec2u(g.x, g.y), v < 0.5);
}
`;
