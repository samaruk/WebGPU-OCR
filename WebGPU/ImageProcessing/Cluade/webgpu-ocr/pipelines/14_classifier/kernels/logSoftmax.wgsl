
struct Params { S: u32, nClass: u32 }
@group(0) @binding(0) var<storage, read>       logits   : array<f32>;
@group(0) @binding(1) var<storage, read_write> logProbs : array<f32>;
@group(0) @binding(2) var<uniform>             params   : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;
  if (s >= params.S) { return; }
  let base = s * params.nClass;
  var maxV = logits[base];
  for (var c = 1u; c < params.nClass; c++) { maxV = max(maxV, logits[base+c]); }
  var sumE = 0.0;
  for (var c = 0u; c < params.nClass; c++) { sumE += exp(logits[base+c]-maxV); }
  let logSumE = log(sumE) + maxV;
  for (var c = 0u; c < params.nClass; c++) { logProbs[base+c] = logits[base+c] - logSumE; }
}
