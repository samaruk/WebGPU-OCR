
struct Params { S: u32, dHead: u32, nHead: u32 }
@group(0) @binding(0) var<storage, read>       Q      : array<f32>;  // [S, nHead*dHead]
@group(0) @binding(1) var<storage, read>       K      : array<f32>;
@group(0) @binding(2) var<storage, read_write> scores : array<f32>;  // [nHead, S, S]
@group(0) @binding(3) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let qi = gid.x; let ki = gid.y; let h = gid.z;
  if (qi >= params.S || ki >= params.S || h >= params.nHead) { return; }
  let D = params.nHead * params.dHead;
  let scale = 1.0 / sqrt(f32(params.dHead));
  var dot = 0.0;
  for (var d = 0u; d < params.dHead; d++) {
    dot += Q[qi*D + h*params.dHead+d] * K[ki*D + h*params.dHead+d];
  }
  scores[(h*params.S+qi)*params.S+ki] = dot * scale;
}
