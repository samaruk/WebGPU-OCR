
struct Params { width: u32, height: u32, ks: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  let W = i32(params.width); let H = i32(params.height);
  if (x >= W || y >= H) { return; }
  let half = i32(params.ks) / 2;
  var best = 1.0;
  for (var ky = -half; ky <= half; ky++) {
    for (var kx = -half; kx <= half; kx++) {
      let nx = clamp(x+kx,0,W-1); let ny = clamp(y+ky,0,H-1);
      best = min(best, input[u32(ny)*u32(W)+u32(nx)]);
    }
  }
  output[u32(y)*u32(W)+u32(x)] = best;
}
