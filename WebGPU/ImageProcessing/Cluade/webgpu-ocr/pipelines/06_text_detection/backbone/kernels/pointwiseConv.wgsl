
// 1x1 pointwise convolution
struct Params { W: u32, H: u32, inC: u32, outC: u32 }
@group(0) @binding(0) var<storage, read>       input   : array<f32>;  // [inC, H, W]
@group(0) @binding(1) var<storage, read_write> output  : array<f32>;  // [outC, H, W]
@group(0) @binding(2) var<storage, read>       weights : array<f32>;  // [outC, inC]
@group(0) @binding(3) var<storage, read>       bias    : array<f32>;  // [outC]
@group(0) @binding(4) var<uniform>             params  : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y; let oc = gid.z;
  if (x >= params.W || y >= params.H || oc >= params.outC) { return; }
  var sum = bias[oc];
  for (var ic = 0u; ic < params.inC; ic++) {
    sum += input[(ic*params.H+y)*params.W+x] * weights[oc*params.inC+ic];
  }
  output[(oc*params.H+y)*params.W+x] = max(sum, 0.0);
}
