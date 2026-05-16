// shaders/pyramid/gaussianPyramid.wgsl — Blur one pyramid level

struct Uniforms {
  src_w   : u32,
  src_h   : u32,
  dst_w   : u32,
  dst_h   : u32,
  radius  : u32,
  sigma   : f32,
  _pad0   : u32,
  _pad1   : u32,
};
@group(0) @binding(0) var<uniform>       u      : Uniforms;
@group(0) @binding(1) var<storage,read>  kernel : array<f32>;
@group(0) @binding(2) var<storage,read>  src    : array<f32>;  // linearised r32float
@group(0) @binding(3) var<storage,read_write> dst : array<f32>;

fn pix(x:i32, y:i32) -> f32 {
  let cx = clamp(x, 0, i32(u.src_w)-1);
  let cy = clamp(y, 0, i32(u.src_h)-1);
  return src[u32(cy * i32(u.src_w) + cx)];
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.dst_w || gid.y >= u.dst_h) { return; }
  let r = i32(u.radius);
  var acc = 0.0; var wsum = 0.0;
  for (var dy=-r; dy<=r; dy++) {
    for (var dx=-r; dx<=r; dx++) {
      let w = kernel[u32(dy+r)] * kernel[u32(dx+r)];
      acc  += pix(i32(gid.x)+dx, i32(gid.y)+dy) * w;
      wsum += w;
    }
  }
  dst[gid.y * u.dst_w + gid.x] = acc / wsum;
}
