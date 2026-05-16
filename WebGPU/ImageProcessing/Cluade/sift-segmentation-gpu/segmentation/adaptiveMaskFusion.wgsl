// segmentation/adaptiveMaskFusion.wgsl – GPU mask fusion kernel
struct Uniforms { width: u32, height: u32, alpha: f32, threshold: f32 }
@group(0) @binding(0) var<uniform> u          : Uniforms;
@group(0) @binding(1) var magTex    : texture_2d<f32>;
@group(0) @binding(2) var<storage> kpDensity  : array<f32>;
@group(0) @binding(3) var maskOut   : texture_storage_2d<r8unorm, write>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let idx    = gid.y * u.width + gid.x;
  let mag    = textureLoad(magTex, vec2<i32>(gid.xy), 0).r;
  let kp     = kpDensity[idx];
  let score  = (1.0 - u.alpha) * mag + u.alpha * kp;
  let binary = select(0.0, 1.0, score > u.threshold);
  textureStore(maskOut, vec2<i32>(gid.xy), vec4<f32>(binary, 0.0, 0.0, 1.0));
}
