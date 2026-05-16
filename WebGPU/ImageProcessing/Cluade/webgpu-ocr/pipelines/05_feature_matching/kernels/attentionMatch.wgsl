
// Cross-attention based matching score
struct Params { N: u32, M: u32, D: u32, temperature: f32 }
@group(0) @binding(0) var<storage, read>       query  : array<f32>;  // [N x D]
@group(0) @binding(1) var<storage, read>       key    : array<f32>;  // [M x D]
@group(0) @binding(2) var<storage, read_write> scores : array<f32>;  // [N x M]
@group(0) @binding(3) var<uniform>             params : Params;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ni = gid.x; let mi = gid.y;
  if (ni >= params.N || mi >= params.M) { return; }
  var dot = 0.0;
  let scale = 1.0 / (sqrt(f32(params.D)) * params.temperature);
  for (var d = 0u; d < params.D; d++) {
    dot += query[ni*params.D+d] * key[mi*params.D+d];
  }
  scores[ni*params.M+mi] = dot * scale;
}
