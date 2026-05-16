
struct Params { width: u32, height: u32, d: u32, sigmaColor: f32, sigmaSpace: f32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }

  let center = input[y * params.width + x];
  let half = i32(params.d) / 2;
  var sum = 0.0; var wsum = 0.0;

  for (var ky = -half; ky <= half; ky++) {
    for (var kx = -half; kx <= half; kx++) {
      let nx = clamp(i32(x)+kx, 0, i32(params.width)-1);
      let ny = clamp(i32(y)+ky, 0, i32(params.height)-1);
      let val = input[u32(ny)*params.width + u32(nx)];
      let spaceDist = f32(kx*kx + ky*ky);
      let colorDist = (val - center) * (val - center);
      let wSpace = exp(-spaceDist / (2.0 * params.sigmaSpace * params.sigmaSpace));
      let wColor = exp(-colorDist / (2.0 * params.sigmaColor * params.sigmaColor));
      let w = wSpace * wColor;
      sum  += val * w;
      wsum += w;
    }
  }
  output[y * params.width + x] = sum / max(wsum, 1e-6);
}
