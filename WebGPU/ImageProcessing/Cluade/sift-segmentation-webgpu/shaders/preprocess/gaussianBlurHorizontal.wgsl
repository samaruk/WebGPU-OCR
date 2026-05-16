// shaders/preprocess/gaussianBlurHorizontal.wgsl — Separable horizontal Gaussian

struct Uniforms { width:u32, height:u32, sigma:f32, radius:u32 };
@group(0) @binding(0) var<uniform>        u      : Uniforms;
@group(0) @binding(1) var<storage,read>   kernel : array<f32>; // precomputed 1-D kernel
@group(0) @binding(2) var                 src    : texture_storage_2d<r32float, read>;
@group(0) @binding(3) var                 dst    : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let r  = i32(u.radius);
  var acc: f32 = 0.0;
  var wsum: f32 = 0.0;
  for (var dx = -r; dx <= r; dx++) {
    let sx = clamp(i32(gid.x) + dx, 0, i32(u.width) - 1);
    let w  = kernel[u32(dx + r)];
    acc  += textureLoad(src, vec2<i32>(sx, i32(gid.y))).r * w;
    wsum += w;
  }
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(acc / wsum, 0.0, 0.0, 1.0));
}
