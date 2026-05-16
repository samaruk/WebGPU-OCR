
// Depthwise separable convolution
struct Params { width: u32, height: u32, channels: u32, kH: u32, kW: u32, stride: u32, pad: u32 }
@group(0) @binding(0) var<storage, read>       input   : array<f32>;
@group(0) @binding(1) var<storage, read_write> output  : array<f32>;
@group(0) @binding(2) var<storage, read>       weights : array<f32>;  // [C x kH x kW]
@group(0) @binding(3) var<uniform>             params  : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ox = gid.x; let oy = gid.y; let c = gid.z;
  let oW = params.width / params.stride;
  let oH = params.height / params.stride;
  if (ox >= oW || oy >= oH || c >= params.channels) { return; }
  var sum = 0.0;
  for (var ky = 0u; ky < params.kH; ky++) {
    for (var kx = 0u; kx < params.kW; kx++) {
      let ix = i32(ox*params.stride+kx) - i32(params.pad);
      let iy = i32(oy*params.stride+ky) - i32(params.pad);
      if (ix>=0 && iy>=0 && u32(ix)<params.width && u32(iy)<params.height) {
        let inIdx = (c*params.height+u32(iy))*params.width+u32(ix);
        let wIdx  = (c*params.kH+ky)*params.kW+kx;
        sum += input[inIdx]*weights[wIdx];
      }
    }
  }
  output[(c*oH+oy)*oW+ox] = max(sum, 0.0);
}
