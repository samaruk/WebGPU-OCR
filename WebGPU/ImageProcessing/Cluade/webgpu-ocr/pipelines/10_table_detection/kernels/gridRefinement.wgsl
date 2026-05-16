
struct Params { W: u32, H: u32, snapRadius: u32 }
@group(0) @binding(0) var<storage, read>       gridIn  : array<f32>;
@group(0) @binding(1) var<storage, read_write> gridOut : array<f32>;
@group(0) @binding(2) var<uniform>             params  : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.W || y >= params.H) { return; }
  let r = i32(params.snapRadius);
  var maxV = 0.0;
  for (var ky = -r; ky <= r; ky++) {
    for (var kx = -r; kx <= r; kx++) {
      let nx = clamp(i32(x)+kx, 0, i32(params.W)-1);
      let ny = clamp(i32(y)+ky, 0, i32(params.H)-1);
      maxV = max(maxV, gridIn[u32(ny)*params.W+u32(nx)]);
    }
  }
  gridOut[y*params.W+x] = select(0.0, gridIn[y*params.W+x], maxV > 0.5);
}
