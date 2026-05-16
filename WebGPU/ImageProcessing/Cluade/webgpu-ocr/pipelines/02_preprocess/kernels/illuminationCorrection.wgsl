
// CLAHE-inspired local contrast normalisation using local mean/std
struct Params { width: u32, height: u32, tileSize: u32, clipLimit: f32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }

  let ts   = i32(params.tileSize);
  let half = ts / 2;
  var mean = 0.0; var cnt = 0.0;

  for (var ky = -half; ky <= half; ky++) {
    for (var kx = -half; kx <= half; kx++) {
      let nx = clamp(i32(x)+kx, 0, i32(params.width)-1);
      let ny = clamp(i32(y)+ky, 0, i32(params.height)-1);
      mean += input[u32(ny)*params.width+u32(nx)];
      cnt  += 1.0;
    }
  }
  mean /= cnt;

  var variance = 0.0;
  for (var ky2 = -half; ky2 <= half; ky2++) {
    for (var kx2 = -half; kx2 <= half; kx2++) {
      let nx2 = clamp(i32(x)+kx2, 0, i32(params.width)-1);
      let ny2 = clamp(i32(y)+ky2, 0, i32(params.height)-1);
      let d   = input[u32(ny2)*params.width+u32(nx2)] - mean;
      variance += d*d;
    }
  }
  variance /= cnt;
let sigma = sqrt(variance + 1e-6);
let val   = (input[y*params.width+x] - mean) / sigma;
  output[y*params.width+x] = clamp(val * 0.3 + 0.5, 0.0, 1.0);
}
