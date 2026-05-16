
struct Params { S: u32, dModel: u32, nClass: u32 }
@group(0) @binding(0) var<storage, read>       x      : array<f32>;  // [S, dModel]
@group(0) @binding(1) var<storage, read>       W      : array<f32>;  // [dModel, nClass]
@group(0) @binding(2) var<storage, read>       b      : array<f32>;  // [nClass]
@group(0) @binding(3) var<storage, read_write> logits : array<f32>;  // [S, nClass]
@group(0) @binding(4) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x; let c = gid.y;
  if (s >= params.S || c >= params.nClass) { return; }
  var sum = b[c];
  for (var d = 0u; d < params.dModel; d++) { sum += x[s*params.dModel+d] * W[d*params.nClass+c]; }
  logits[s*params.nClass+c] = sum;
}
