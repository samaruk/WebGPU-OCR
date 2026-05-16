
struct Params { width: u32, height: u32, kernelSize: u32, sigma: f32, pass_: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

fn gaussian(x: f32, sigma: f32) -> f32 {
  return exp(-0.5 * x * x / (sigma * sigma));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }

  let half = i32(params.kernelSize) / 2;
  var sum: f32 = 0.0;
  var wsum: f32 = 0.0;

  for (var k = -half; k <= half; k++) {
    var sx = i32(x); var sy = i32(y);
    if (params.pass_ == 0u) { sx += k; } else { sy += k; }
    sx = clamp(sx, 0, i32(params.width)  - 1);
    sy = clamp(sy, 0, i32(params.height) - 1);
    let w = gaussian(f32(k), params.sigma);
    sum  += input[u32(sy) * params.width + u32(sx)] * w;
    wsum += w;
  }
  output[y * params.width + x] = sum / wsum;
}
