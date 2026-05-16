// shaders/segmentation/localLabelInit.wgsl — Initialise CCL labels to pixel index

struct Uniforms { pixel_count:u32, _pad0:u32, _pad1:u32, _pad2:u32 };
@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read>       binary : array<u32>;
@group(0) @binding(2) var<storage,read_write> labels : array<u32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.pixel_count) { return; }
  labels[gid.x] = select(0u, gid.x + 1u, binary[gid.x] != 0u);
}
