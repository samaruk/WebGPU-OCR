// shaders/sift/dog.wgsl — Difference-of-Gaussians (layer n+1 - layer n)

struct Uniforms { width:u32, height:u32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>         u     : Uniforms;
@group(0) @binding(1) var<storage,read>    upper : array<f32>; // blurred at sigma*k
@group(0) @binding(2) var<storage,read>    lower : array<f32>; // blurred at sigma
@group(0) @binding(3) var<storage,read_write> dog : array<f32>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let idx     = gid.y * u.width + gid.x;
  dog[idx]    = upper[idx] - lower[idx];
}
