// stroke/gradientMap.wgsl – Sobel gradient shader (standalone reference)
@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var mag : texture_storage_2d<r32float, write>;
@group(0) @binding(2) var dir : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(src);
  let p    = vec2<i32>(gid.xy);
  if (gid.x < 1u || gid.y < 1u || gid.x >= dims.x - 1u || gid.y >= dims.y - 1u) { return; }
  let gx = -textureLoad(src, p + vec2<i32>(-1,-1), 0).r - 2.0*textureLoad(src, p + vec2<i32>(-1,0), 0).r - textureLoad(src, p + vec2<i32>(-1,1), 0).r
           +textureLoad(src, p + vec2<i32>( 1,-1), 0).r + 2.0*textureLoad(src, p + vec2<i32>( 1,0), 0).r + textureLoad(src, p + vec2<i32>( 1,1), 0).r;
  let gy = -textureLoad(src, p + vec2<i32>(-1,-1), 0).r - 2.0*textureLoad(src, p + vec2<i32>(0,-1), 0).r - textureLoad(src, p + vec2<i32>(1,-1), 0).r
           +textureLoad(src, p + vec2<i32>(-1, 1), 0).r + 2.0*textureLoad(src, p + vec2<i32>(0, 1), 0).r + textureLoad(src, p + vec2<i32>(1, 1), 0).r;
  textureStore(mag, p, vec4<f32>(sqrt(gx*gx+gy*gy)*0.25, 0.0, 0.0, 1.0));
  textureStore(dir, p, vec4<f32>(atan2(gy, gx), 0.0, 0.0, 1.0));
}
