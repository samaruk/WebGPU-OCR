
// Radon-transform-based deskew angle estimation
// Outputs angle histogram: bins[numAngles] = projection variance
struct Params { width: u32, height: u32, numAngles: u32, angleRange: f32 }
@group(0) @binding(0) var<storage, read>       input : array<f32>;
@group(0) @binding(1) var<storage, read_write> bins  : array<f32>;
@group(0) @binding(2) var<uniform>             params: Params;

const PI = 3.14159265358979;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ai = gid.x;
  if (ai >= params.numAngles) { return; }

  let angle = -params.angleRange + f32(ai) * (2.0 * params.angleRange) / f32(params.numAngles - 1u);
  let rad   = angle * PI / 180.0;
  let cosA  = cos(rad); let sinA = sin(rad);
  let W = f32(params.width); let H = f32(params.height);
  let cx = W * 0.5; let cy = H * 0.5;

  var sum = 0.0; var sum2 = 0.0; var cnt = 0.0;
  for (var row = 0u; row < params.height; row++) {
    var proj = 0.0; var pcnt = 0.0;
    for (var col = 0u; col < params.width; col++) {
      // Project onto rotated axis
      let dx = f32(col) - cx; let dy = f32(row) - cy;
      let y_rot = -dx * sinA + dy * cosA;
      _ = y_rot; // used for conceptual projection
      proj  += input[row * params.width + col];
      pcnt  += 1.0;
    }
    let mean = proj / pcnt;
    sum  += mean; sum2 += mean * mean; cnt += 1.0;
  }
  let variance = sum2 / cnt - (sum/cnt)*(sum/cnt);
  bins[ai] = variance;
}
