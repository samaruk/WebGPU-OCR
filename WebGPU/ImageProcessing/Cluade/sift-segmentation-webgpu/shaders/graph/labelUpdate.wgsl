// shaders/graph/labelUpdate.wgsl — Propagate label updates through pixel array

struct Uniforms { pixel_count:u32, max_labels:u32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read>       map    : array<u32>; // label → new_label
@group(0) @binding(2) var<storage,read_write> labels : array<u32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.pixel_count) { return; }
  let l = labels[gid.x];
  if (l == 0u || l >= u.max_labels) { return; }
  let nl = map[l];
  if (nl != 0u) { labels[gid.x] = nl; }
}
