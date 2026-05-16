
// L2-normalize descriptor vectors
struct Params { N: u32, D: u32 }
@group(0) @binding(0) var<storage, read>       raw   : array<f32>;  // [N x D]
@group(0) @binding(1) var<storage, read_write> desc  : array<f32>;  // [N x D] normalized
@group(0) @binding(2) var<uniform>             params: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.N) { return; }
  let base = n * params.D;
  var norm = 0.0;
  for (var d = 0u; d < params.D; d++) { let v = raw[base+d]; norm += v*v; }
  norm = sqrt(norm + 1e-6);
  for (var d2 = 0u; d2 < params.D; d2++) { desc[base+d2] = raw[base+d2] / norm; }
}
