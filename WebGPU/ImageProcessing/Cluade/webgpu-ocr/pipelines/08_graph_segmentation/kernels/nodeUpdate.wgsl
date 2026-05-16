
struct Params { N: u32, D: u32, alpha: f32 }
@group(0) @binding(0) var<storage, read_write> nodeF  : array<f32>;
@group(0) @binding(1) var<storage, read>       msg    : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.N * params.D) { return; }
  nodeF[i] = max((1.0 - params.alpha) * nodeF[i] + params.alpha * msg[i], 0.0);
}
