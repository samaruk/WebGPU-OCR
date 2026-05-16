
struct Params { seqLen: u32, dModel: u32 }
@group(0) @binding(0) var<storage, read_write> pe    : array<f32>;  // [seqLen, dModel]
@group(0) @binding(1) var<uniform>             params: Params;
const PI = 3.14159265358979;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let pos = gid.x; let dim = gid.y;
  if (pos >= params.seqLen || dim >= params.dModel) { return; }
  let i = pos * params.dModel + dim;
  let div = pow(10000.0, f32(dim / 2u * 2u) / f32(params.dModel));
  if (dim % 2u == 0u) { pe[i] = sin(f32(pos) / div); }
  else                { pe[i] = cos(f32(pos) / div); }
}
