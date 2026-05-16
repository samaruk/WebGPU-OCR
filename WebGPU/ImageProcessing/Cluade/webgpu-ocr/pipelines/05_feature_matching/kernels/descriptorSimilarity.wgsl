
// Brute-force descriptor similarity (dot product)
struct Params { N: u32, M: u32, D: u32 }
@group(0) @binding(0) var<storage, read>       descA : array<f32>;  // [N x D]
@group(0) @binding(1) var<storage, read>       descB : array<f32>;  // [M x D]
@group(0) @binding(2) var<storage, read_write> sim   : array<f32>;  // [N x M]
@group(0) @binding(3) var<uniform>             params: Params;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ni = gid.x; let mi = gid.y;
  if (ni >= params.N || mi >= params.M) { return; }
  var dot = 0.0;
  for (var d = 0u; d < params.D; d++) {
    dot += descA[ni*params.D+d] * descB[mi*params.D+d];
  }
  sim[ni*params.M+mi] = dot;
}
