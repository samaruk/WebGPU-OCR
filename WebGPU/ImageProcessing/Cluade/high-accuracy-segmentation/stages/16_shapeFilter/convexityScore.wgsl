// convexityScore.wgsl
// Computes local convexity score per component via bounding box fill ratio (GPU side).
struct Params { width: u32, height: u32, component_id: u32, _pad: u32 }
@group(0) @binding(0) var labelTex: texture_2d<u32>;
@group(0) @binding(1) var<storage, read_write> pixelCount: array<atomic<u32>>; // [count]
@group(0) @binding(2) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let id = textureLoad(labelTex, vec2<i32>(gid.xy), 0).r;
  if (id == p.component_id) { atomicAdd(&pixelCount[0], 1u); }
}
