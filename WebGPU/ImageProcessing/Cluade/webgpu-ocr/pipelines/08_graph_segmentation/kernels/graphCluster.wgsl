
struct Params { N: u32, D: u32, K: u32, thresh: f32 }
@group(0) @binding(0) var<storage, read>       nodeF    : array<f32>;  // [N,D]
@group(0) @binding(1) var<storage, read_write> clusters : array<u32>;  // [N]
@group(0) @binding(2) var<storage, read>       centroids: array<f32>;  // [K,D]
@group(0) @binding(3) var<uniform>             params   : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.N) { return; }
  var bestK = 0u; var bestD = 1e30;
  for (var k = 0u; k < params.K; k++) {
    var dist = 0.0;
    for (var d = 0u; d < params.D; d++) {
      let dv = nodeF[n*params.D+d] - centroids[k*params.D+d];
      dist += dv*dv;
    }
    if (dist < bestD) { bestD = dist; bestK = k; }
  }
  clusters[n] = bestK;
}
