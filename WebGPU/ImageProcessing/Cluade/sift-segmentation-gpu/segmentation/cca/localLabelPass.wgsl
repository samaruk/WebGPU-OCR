// segmentation/cca/localLabelPass.wgsl – GPU local 8×8 tile labelling kernel
struct Uniforms { width: u32, height: u32, _pad0: u32, _pad1: u32 }
@group(0) @binding(0) var<uniform> u    : Uniforms;
@group(0) @binding(1) var maskTex : texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> labels : array<i32>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let idx = gid.y * u.width + gid.x;
  let v   = textureLoad(maskTex, vec2<i32>(gid.xy), 0).r;
  labels[idx] = select(-1, i32(idx), v > 0.5);
}
