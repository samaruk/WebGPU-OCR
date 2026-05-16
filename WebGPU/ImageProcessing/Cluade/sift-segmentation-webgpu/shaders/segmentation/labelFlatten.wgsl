// shaders/segmentation/labelFlatten.wgsl — Path-compression to canonical root

struct Uniforms { pixel_count:u32, _pad0:u32, _pad1:u32, _pad2:u32 };
@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read_write> labels : array<u32>;

fn find_root(start: u32) -> u32 {
  var r = start;
  for (var i=0u; i<128u; i++) {
    let p = labels[r];
    if (p == 0u || p == r+1u) { break; }
    r = p - 1u;
  }
  return r;
}

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.pixel_count) { return; }
  if (labels[gid.x] == 0u) { return; }
  labels[gid.x] = find_root(gid.x) + 1u;
}
