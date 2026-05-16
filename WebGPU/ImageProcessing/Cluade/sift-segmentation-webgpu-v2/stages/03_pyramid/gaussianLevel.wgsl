// gaussianLevel.wgsl — 2-D separable Gaussian blur for one pyramid level
// Bindings: 0=uniform  1=kernel  2=src  3=dst  (4 total — no tmp needed)
struct Uni {
  src_w  : u32,
  src_h  : u32,
  dst_w  : u32,
  dst_h  : u32,
  radius : u32,
  _p0    : u32,
  _p1    : u32,
  _p2    : u32,
};

@group(0) @binding(0) var<uniform>            u   : Uni;
@group(0) @binding(1) var<storage,read>       k   : array<f32>;   // 1-D kernel [2*radius+1]
@group(0) @binding(2) var<storage,read>       src : array<f32>;   // input level
@group(0) @binding(3) var<storage,read_write> dst : array<f32>;   // output level

// Clamped pixel access into src
fn px(x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(u.src_w) - 1);
  let cy = clamp(y, 0, i32(u.src_h) - 1);
  return src[u32(cy) * u.src_w + u32(cx)];
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.dst_w || gid.y >= u.dst_h) { return; }

  let r   = i32(u.radius);
  var acc = 0.0;
  var ws  = 0.0;

  // Combined 2-D convolution (k ⊗ k) — fine for radius ≤ 15
  for (var dy = -r; dy <= r; dy++) {
    let wy = k[u32(dy + r)];
    for (var dx = -r; dx <= r; dx++) {
      let ww = wy * k[u32(dx + r)];
      acc += px(i32(gid.x) + dx, i32(gid.y) + dy) * ww;
      ws  += ww;
    }
  }

  dst[gid.y * u.dst_w + gid.x] = acc / ws;
}
