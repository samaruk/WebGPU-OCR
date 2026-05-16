
struct Params { N: u32, D: u32 }
@group(0) @binding(0) var<storage, read>       nodeF  : array<f32>;  // [N,D]
@group(0) @binding(1) var<storage, read>       edgeW  : array<f32>;  // [N,N]
@group(0) @binding(2) var<storage, read_write> msgOut : array<f32>;  // [N,D]
@group(0) @binding(3) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ni = gid.x;
  if (ni >= params.N) { return; }
  var wSum = 0.0;
  for (var d = 0u; d < params.D; d++) { msgOut[ni*params.D+d] = 0.0; }
  for (var nj = 0u; nj < params.N; nj++) {
    let w = edgeW[ni*params.N+nj];
    if (w < 1e-8) { continue; }
    for (var d = 0u; d < params.D; d++) { msgOut[ni*params.D+d] += w * nodeF[nj*params.D+d]; }
    wSum += w;
  }
  if (wSum > 1e-8) {
    for (var d = 0u; d < params.D; d++) { msgOut[ni*params.D+d] /= wSum; }
  }
}
