// shaders/grayscale.wgsl

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> weights: vec4<f32>; // rw, gw, bw, _

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(src);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let c = textureLoad(src, vec2<i32>(gid.xy), 0);
  let g = dot(c.rgb, weights.xyz);
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(g, g, g, 1.0));
}
