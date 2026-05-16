
struct Params { width: u32, height: u32, thresh: f32 }
@group(0) @binding(0) var<storage, read>       labels  : array<f32>;
@group(0) @binding(1) var<storage, read_write> contour : array<f32>;
@group(0) @binding(2) var<uniform>             params  : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  let W = i32(params.width); let H = i32(params.height);
  if (x >= W || y >= H) { return; }
  let i = u32(y)*u32(W)+u32(x);
  let v = labels[i];
  if (v <= params.thresh) { contour[i] = 0.0; return; }
  var isEdge = false;
  let dx = array<i32,4>(-1,1,0,0); let dy = array<i32,4>(0,0,-1,1);
  for (var k = 0u; k < 4u; k++) {
    let nx = clamp(x+dx[k],0,W-1); let ny = clamp(y+dy[k],0,H-1);
    if (labels[u32(ny)*u32(W)+u32(nx)] <= params.thresh) { isEdge = true; }
  }
  contour[i] = select(0.0, 1.0, isEdge);
}
