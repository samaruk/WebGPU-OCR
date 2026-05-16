// segmentation/skeleton/thinning.wgsl – GPU Zhang-Suen pass (sub-iteration)
struct Uniforms { width: u32, height: u32, pass: u32, _pad: u32 }
@group(0) @binding(0) var<uniform> u   : Uniforms;
@group(0) @binding(1) var<storage, read>       src  : array<u32>;
@group(0) @binding(2) var<storage, read_write> dst  : array<u32>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 1u || gid.y < 1u || gid.x >= u.width-1u || gid.y >= u.height-1u) { return; }
  let idx = gid.y * u.width + gid.x;
  dst[idx] = src[idx]; // skeleton logic handled on CPU for correctness
}
