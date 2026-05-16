// sift/dog.wgsl – GPU DoG subtraction kernel
@group(0) @binding(0) var scaleA    : texture_2d<f32>;
@group(0) @binding(1) var scaleB    : texture_2d<f32>;
@group(0) @binding(2) var dogOutput : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims = textureDimensions(dogOutput);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let a = textureLoad(scaleA, vec2<i32>(gid.xy), 0).r;
  let b = textureLoad(scaleB, vec2<i32>(gid.xy), 0).r;
  textureStore(dogOutput, vec2<i32>(gid.xy), vec4<f32>(b - a, 0.0, 0.0, 1.0));
}
