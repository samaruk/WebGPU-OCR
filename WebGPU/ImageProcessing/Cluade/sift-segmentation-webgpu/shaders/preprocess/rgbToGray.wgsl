// shaders/preprocess/rgbToGray.wgsl

struct Uniforms { width:u32, height:u32, inv_w:f32, inv_h:f32 };
@group(0) @binding(0) var<uniform> u        : Uniforms;
@group(0) @binding(1) var          src_tex  : texture_2d<f32>;
@group(0) @binding(2) var          dst_tex  : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let c   = textureLoad(src_tex, vec2<i32>(gid.xy), 0);
  // Linearise sRGB then convert to luminance
  let lin = pow(c.rgb, vec3<f32>(2.2));
  let lum = dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722));
  textureStore(dst_tex, vec2<i32>(gid.xy), vec4<f32>(lum,0.0,0.0,1.0));
}
