
// Generic 2D convolution: conv4
struct Params {
  inW: u32, inH: u32, outC: u32, inC: u32,
  kH: u32, kW: u32, stride: u32, pad: u32,
}
@group(0) @binding(0) var<storage, read>       input   : array<f32>;
@group(0) @binding(1) var<storage, read_write> output  : array<f32>;
@group(0) @binding(2) var<storage, read>       weights : array<f32>;
@group(0) @binding(3) var<storage, read>       bias    : array<f32>;
@group(0) @binding(4) var<uniform>             params  : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ox = gid.x; let oy = gid.y; let oc = gid.z;
  if (ox >= params.inW / params.stride || oy >= params.inH / params.stride || oc >= params.outC) { return; }
  var sum = bias[oc];
  for (var ic = 0u; ic < params.inC; ic++) {
    for (var ky = 0u; ky < params.kH; ky++) {
      for (var kx = 0u; kx < params.kW; kx++) {
        let ix = i32(ox * params.stride + kx) - i32(params.pad);
        let iy = i32(oy * params.stride + ky) - i32(params.pad);
        if (ix >= 0 && iy >= 0 && u32(ix) < params.inW && u32(iy) < params.inH) {
          let inIdx = (ic * params.inH + u32(iy)) * params.inW + u32(ix);
          let wIdx  = ((oc * params.inC + ic) * params.kH + ky) * params.kW + kx;
          sum += input[inIdx] * weights[wIdx];
        }
      }
    }
  }
  let outW = params.inW / params.stride;
  let outH = params.inH / params.stride;
  output[(oc * outH + oy) * outW + ox] = max(sum, 0.0); // ReLU
}
