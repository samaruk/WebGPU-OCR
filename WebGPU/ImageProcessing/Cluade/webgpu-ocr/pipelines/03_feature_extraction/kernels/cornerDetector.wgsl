
// Harris corner detection
struct Params { width: u32, height: u32, k: f32, thresh: f32 }
@group(0) @binding(0) var<storage, read>       gx     : array<f32>;
@group(0) @binding(1) var<storage, read>       gy     : array<f32>;
@group(0) @binding(2) var<storage, read_write> response: array<f32>;
@group(0) @binding(3) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  let W = i32(params.width); let H = i32(params.height);
  if (x >= W || y >= H) { return; }
  var sxx = 0.0; var syy = 0.0; var sxy = 0.0;
  for (var ky = -2; ky <= 2; ky++) {
    for (var kx = -2; kx <= 2; kx++) {
      let nx = clamp(x+kx,0,W-1); let ny = clamp(y+ky,0,H-1);
      let i  = u32(ny)*u32(W)+u32(nx);
      sxx += gx[i]*gx[i]; syy += gy[i]*gy[i]; sxy += gx[i]*gy[i];
    }
  }
  let det   = sxx*syy - sxy*sxy;
  let trace = sxx + syy;
  let R     = det - params.k * trace * trace;
  response[u32(y)*u32(W)+u32(x)] = R;
}
