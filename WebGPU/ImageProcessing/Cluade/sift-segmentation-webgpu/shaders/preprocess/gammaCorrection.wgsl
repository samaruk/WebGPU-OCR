// shaders/preprocess/gammaCorrection.wgsl

struct Uniforms { width:u32, height:u32, gamma:f32, _pad:u32 };
@group(0) @binding(0) var<uniform> u   : Uniforms;
@group(0) @binding(1) var src          : texture_storage_2d<r32float, read>;
@group(0) @binding(2) var dst          : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let v = textureLoad(src, vec2<i32>(gid.xy)).r;
  let o = pow(clamp(v, 0.0, 1.0), 1.0 / u.gamma);
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(o,0.0,0.0,1.0));
}
