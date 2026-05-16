
struct Params { C: u32, reducedC: u32, HW: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;  // [C, HW]
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<storage, read>       w1     : array<f32>;  // [reducedC, C]
@group(0) @binding(3) var<storage, read>       w2     : array<f32>;  // [C, reducedC]
@group(0) @binding(4) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let c = gid.x;
  if (c >= params.C) { return; }
  // Global avg pool
  var gap = 0.0;
  for (var i = 0u; i < params.HW; i++) { gap += input[c*params.HW+i]; }
  gap /= f32(params.HW);
  // FC1 + ReLU
  var fc1 = array<f32, 16>();
  for (var r = 0u; r < min(params.reducedC, 16u); r++) {
    var s = 0.0;
    for (var cc = 0u; cc < params.C; cc++) { s += w1[r*params.C+cc] * gap; }
    fc1[r] = max(s, 0.0);
  }
  // FC2 + sigmoid
  var scale = 0.0;
  for (var r2 = 0u; r2 < min(params.reducedC, 16u); r2++) { scale += w2[c*params.reducedC+r2] * fc1[r2]; }
  scale = 1.0 / (1.0 + exp(-scale));
  for (var i2 = 0u; i2 < params.HW; i2++) { output[c*params.HW+i2] = input[c*params.HW+i2] * scale; }
}
