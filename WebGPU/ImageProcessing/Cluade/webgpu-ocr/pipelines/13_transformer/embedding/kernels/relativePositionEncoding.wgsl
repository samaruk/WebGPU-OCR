
struct Params { seqLen: u32, dModel: u32, maxDist: u32 }
@group(0) @binding(0) var<storage, read_write> relPE  : array<f32>;  // [2*maxDist+1, dModel]
@group(0) @binding(1) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let rel = i32(gid.x) - i32(params.maxDist);
  let dim = gid.y;
  if (u32(gid.x) >= 2u*params.maxDist+1u || dim >= params.dModel) { return; }
  let i = gid.x * params.dModel + dim;
  let div = pow(10000.0, f32(dim / 2u * 2u) / f32(params.dModel));
  if (dim % 2u == 0u) { relPE[i] = sin(f32(rel) / div); }
  else                { relPE[i] = cos(f32(rel) / div); }
}
