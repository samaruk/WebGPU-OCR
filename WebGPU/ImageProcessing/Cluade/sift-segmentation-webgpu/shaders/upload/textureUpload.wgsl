// shaders/upload/textureUpload.wgsl — Copy rgba8 texture to r32float storage texture

@group(0) @binding(0) var src_tex    : texture_2d<f32>;
@group(0) @binding(1) var dst_tex    : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dim = textureDimensions(src_tex);
  if (gid.x >= dim.x || gid.y >= dim.y) { return; }
  let rgba = textureLoad(src_tex, vec2<i32>(gid.xy), 0);
  // Luminance: BT.709
  let lum  = dot(rgba.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  textureStore(dst_tex, vec2<i32>(gid.xy), vec4<f32>(lum, 0.0, 0.0, 1.0));
}
