// gaussianPyramid.wgsl – standalone blur kernel (used by gaussianPyramid.js via import)
struct Uniforms { width: u32, height: u32, sigma: f32, radius: u32 }
@group(0) @binding(0) var<uniform> u  : Uniforms;
@group(0) @binding(1) var srcTex  : texture_2d<f32>;
@group(0) @binding(2) var dstTex  : texture_storage_2d<r8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  var acc = 0.0; var w2 = 0.0;
  let r = i32(u.radius);
  for (var dx = -r; dx <= r; dx++) {
    let sx = clamp(i32(gid.x) + dx, 0, i32(u.width) - 1);
    let wt = exp(-f32(dx*dx) / (2.0*u.sigma*u.sigma));
    acc += textureLoad(srcTex, vec2<i32>(sx, i32(gid.y)), 0).r * wt;
    w2  += wt;
  }
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(acc / w2, 0.0, 0.0, 1.0));
}
