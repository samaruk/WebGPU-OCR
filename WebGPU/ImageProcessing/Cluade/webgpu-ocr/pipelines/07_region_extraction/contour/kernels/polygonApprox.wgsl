
// Mark corner pixels in contour using curvature
struct Params { width: u32, height: u32, radius: u32 }
@group(0) @binding(0) var<storage, read>       contour : array<f32>;
@group(0) @binding(1) var<storage, read_write> corners : array<f32>;
@group(0) @binding(2) var<uniform>             params  : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  let W = i32(params.width); let H = i32(params.height);
  if (x >= W || y >= H) { return; }
  let i = u32(y)*u32(W)+u32(x);
  if (contour[i] < 0.5) { corners[i] = 0.0; return; }
  let r = i32(params.radius);
  var cnt = 0.0;
  for (var ky = -r; ky <= r; ky++) {
    for (var kx = -r; kx <= r; kx++) {
      if (kx == 0 && ky == 0) { continue; }
      let nx = clamp(x+kx,0,W-1); let ny = clamp(y+ky,0,H-1);
      cnt += contour[u32(ny)*u32(W)+u32(nx)];
    }
  }
  corners[i] = select(0.0, 1.0, cnt < 3.0 && contour[i] > 0.5);
}
