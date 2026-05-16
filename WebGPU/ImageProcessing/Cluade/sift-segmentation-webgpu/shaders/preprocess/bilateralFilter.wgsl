// shaders/preprocess/bilateralFilter.wgsl — Edge-preserving bilateral filter

struct Uniforms {
  width    : u32,
  height   : u32,
  sigma_s  : f32,  // spatial sigma
  sigma_r  : f32,  // range sigma
  radius   : u32,
  _pad0    : u32, _pad1:u32, _pad2:u32,
};
@group(0) @binding(0) var<uniform> u   : Uniforms;
@group(0) @binding(1) var          src : texture_storage_2d<r32float, read>;
@group(0) @binding(2) var          dst : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let cx   = i32(gid.x);
  let cy   = i32(gid.y);
  let r    = i32(u.radius);
  let ic   = textureLoad(src, vec2<i32>(cx, cy)).r;
  let inv2ss = 1.0 / (2.0 * u.sigma_s * u.sigma_s);
  let inv2sr = 1.0 / (2.0 * u.sigma_r * u.sigma_r);
  var sum  = 0.0;
  var wsum = 0.0;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let nx = clamp(cx+dx, 0, i32(u.width)-1);
      let ny = clamp(cy+dy, 0, i32(u.height)-1);
      let iv = textureLoad(src, vec2<i32>(nx, ny)).r;
      let ws = exp(-f32(dx*dx + dy*dy) * inv2ss);
      let wr = exp(-(iv-ic)*(iv-ic) * inv2sr);
      let w  = ws * wr;
      sum  += iv * w;
      wsum += w;
    }
  }
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(sum/wsum, 0.0, 0.0, 1.0));
}
