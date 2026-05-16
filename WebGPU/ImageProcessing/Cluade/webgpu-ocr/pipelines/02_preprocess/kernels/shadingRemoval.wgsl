
// Background subtraction via local maximum estimation
struct Params { width: u32, height: u32, radius: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }
  let r = i32(params.radius);
  var maxVal = 0.0;
  for (var ky = -r; ky <= r; ky++) {
    for (var kx = -r; kx <= r; kx++) {
      let nx = clamp(i32(x)+kx, 0, i32(params.width)-1);
      let ny = clamp(i32(y)+ky, 0, i32(params.height)-1);
      maxVal = max(maxVal, input[u32(ny)*params.width+u32(nx)]);
    }
  }
  let val = input[y*params.width+x];
  output[y*params.width+x] = clamp(val / max(maxVal, 1e-4), 0.0, 1.0);
}
