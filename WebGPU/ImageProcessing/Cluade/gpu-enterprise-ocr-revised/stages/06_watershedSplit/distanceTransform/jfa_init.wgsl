// JFA init: mark BACKGROUND pixels as seeds.
// Distance transform of background → each foreground pixel gets its
// distance to the nearest background pixel = inward distance (stroke half-width).
// Stroke centers (medial axis) become local maxima → valid watershed seeds.
//
// Bindings: 4
//   0 = binaryTex  texture_2d<f32>  (fg=1 = text, bg=0 = background)
//   1 = seedX      array<u32>  read_write
//   2 = seedY      array<u32>  read_write
//   3 = dims       uniform vec4<u32>  x=W, y=H

@group(0) @binding(0) var binaryTex : texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> seedX : array<u32>;
@group(0) @binding(2) var<storage, read_write> seedY : array<u32>;
@group(0) @binding(3) var<uniform> dims : vec4<u32>;

const EMPTY : u32 = 0xFFFFFFFFu;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = dims.x; let H = dims.y;
  if (gid.x >= W || gid.y >= H) { return; }
  let idx = gid.y * W + gid.x;
  // Mark background pixels as seeds (fg < 0.5 = background)
  let isBG = textureLoad(binaryTex, vec2<i32>(gid.xy), 0).r < 0.5;
  seedX[idx] = select(EMPTY, gid.x, isBG);
  seedY[idx] = select(EMPTY, gid.y, isBG);
}
