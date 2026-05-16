
struct Params { W: u32, H: u32, C: u32, eps: f32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;  // [C,H,W]
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<storage, read>       gamma  : array<f32>;  // [C]
@group(0) @binding(3) var<storage, read>       beta   : array<f32>;  // [C]
@group(0) @binding(4) var<storage, read>       mean   : array<f32>;  // [C]
@group(0) @binding(5) var<storage, read>       vari   : array<f32>;  // [C]
@group(0) @binding(6) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y; let c = gid.z;
  if (x >= params.W || y >= params.H || c >= params.C) { return; }
  let i   = (c*params.H+y)*params.W+x;
  let val = (input[i] - mean[c]) / sqrt(vari[c] + params.eps);
  output[i] = gamma[c] * val + beta[c];
}
