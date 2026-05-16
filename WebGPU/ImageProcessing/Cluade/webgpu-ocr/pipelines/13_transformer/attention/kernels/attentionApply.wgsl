
struct Params { S: u32, dHead: u32, nHead: u32, dModel: u32 }
@group(0) @binding(0) var<storage, read>       attnW  : array<f32>;  // [nH, S, S]
@group(0) @binding(1) var<storage, read>       V      : array<f32>;  // [S, nH*dHead]
@group(0) @binding(2) var<storage, read>       Wo     : array<f32>;  // [nH*dHead, dModel]
@group(0) @binding(3) var<storage, read_write> out    : array<f32>;  // [S, dModel]
@group(0) @binding(4) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x; let od = gid.y;
  if (s >= params.S || od >= params.dModel) { return; }
  let D = params.nHead * params.dHead;
  var val = 0.0;
  for (var h = 0u; h < params.nHead; h++) {
    for (var d = 0u; d < params.dHead; d++) {
      var ctx = 0.0;
      for (var k = 0u; k < params.S; k++) {
        ctx += attnW[(h*params.S+s)*params.S+k] * V[k*D+h*params.dHead+d];
      }
      val += ctx * Wo[(h*params.dHead+d)*params.dModel+od];
    }
  }
  out[s*params.dModel+od] = val;
}
