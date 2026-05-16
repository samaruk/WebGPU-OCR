// segmentation/skeleton/endpointDetect.wgsl – GPU endpoint/junction detection
@group(0) @binding(0) var<storage, read>       skeleton   : array<u32>;
@group(0) @binding(1) var<storage, read_write> endpoints  : array<vec2<u32>>;
@group(0) @binding(2) var<storage, read_write> epCount    : atomic<u32>;
struct Uniforms { width: u32, height: u32, _p0: u32, _p1: u32 }
@group(0) @binding(3) var<uniform> u : Uniforms;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 1u || gid.y < 1u || gid.x >= u.width-1u || gid.y >= u.height-1u) { return; }
  if (skeleton[gid.y * u.width + gid.x] == 0u) { return; }
  var cnt = 0u;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dy == 0 && dx == 0) { continue; }
      if (skeleton[(gid.y + u32(dy)) * u.width + (gid.x + u32(dx))] > 0u) { cnt++; }
    }
  }
  if (cnt == 1u) {
    let i = atomicAdd(&epCount, 1u);
    endpoints[i] = vec2<u32>(gid.x, gid.y);
  }
}
