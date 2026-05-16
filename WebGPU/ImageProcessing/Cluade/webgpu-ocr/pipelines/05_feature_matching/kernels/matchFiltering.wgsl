
// Mutual nearest-neighbour match filtering
struct Params { N: u32, M: u32, ratioThresh: f32 }
@group(0) @binding(0) var<storage, read>       sim     : array<f32>;  // [N x M]
@group(0) @binding(1) var<storage, read_write> matches : array<i32>;  // [N] → M idx or -1
@group(0) @binding(2) var<uniform>             params  : Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ni = gid.x;
  if (ni >= params.N) { return; }
  var best1 = -1i; var best1v = -1e9;
  var best2v = -1e9;
  for (var m = 0u; m < params.M; m++) {
    let v = sim[ni*params.M+m];
    if (v > best1v) { best2v = best1v; best1v = v; best1 = i32(m); }
    else if (v > best2v) { best2v = v; }
  }
  if (best1 >= 0 && (best2v < -1e8 || best1v / max(best2v, 1e-8) >= params.ratioThresh)) {
    matches[ni] = best1;
  } else {
    matches[ni] = -1;
  }
}
