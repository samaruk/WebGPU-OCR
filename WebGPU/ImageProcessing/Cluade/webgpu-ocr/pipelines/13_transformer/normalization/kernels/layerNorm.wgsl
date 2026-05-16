
struct Params { seqLen: u32, dModel: u32, eps: f32 }
@group(0) @binding(0) var<storage, read_write> x      : array<f32>;
@group(0) @binding(1) var<storage, read>       gamma  : array<f32>;
@group(0) @binding(2) var<storage, read>       beta   : array<f32>;
@group(0) @binding(3) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;
  if (s >= params.seqLen) { return; }
  let base = s * params.dModel;
  var mean = 0.0;
  for (var d = 0u; d < params.dModel; d++) { mean += x[base+d]; }
  mean /= f32(params.dModel);
  var vari = 0.0;
  for (var d = 0u; d < params.dModel; d++) { let dv = x[base+d]-mean; vari += dv*dv; }
  vari /= f32(params.dModel);
  let std = sqrt(vari + params.eps);
  for (var d = 0u; d < params.dModel; d++) {
    x[base+d] = gamma[d] * (x[base+d]-mean)/std + beta[d];
  }
}
