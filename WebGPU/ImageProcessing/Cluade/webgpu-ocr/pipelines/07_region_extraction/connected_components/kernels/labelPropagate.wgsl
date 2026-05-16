
struct Params { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read_write> labels : array<u32>;
@group(0) @binding(1) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  let W = i32(params.width); let H = i32(params.height);
  if (x >= W || y >= H) { return; }
  let i = u32(y)*u32(W)+u32(x);
  if (labels[i] == 0u) { return; }
  var minL = labels[i];
  let dx = array<i32,4>(-1, 1, 0, 0);
  let dy = array<i32,4>(0, 0, -1, 1);
  for (var k = 0u; k < 4u; k++) {
    let nx = clamp(x+dx[k], 0, W-1); let ny = clamp(y+dy[k], 0, H-1);
    let nl = labels[u32(ny)*u32(W)+u32(nx)];
    if (nl > 0u && nl < minL) { minL = nl; }
  }
  labels[i] = minL;
}
