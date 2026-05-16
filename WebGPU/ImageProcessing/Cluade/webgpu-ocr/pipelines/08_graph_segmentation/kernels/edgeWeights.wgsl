
struct Params { numNodes: u32, featDim: u32 }
@group(0) @binding(0) var<storage, read>       nodeF   : array<f32>;  // [N, D]
@group(0) @binding(1) var<storage, read>       adjMat  : array<u32>;  // [N, N]
@group(0) @binding(2) var<storage, read_write> edgeW   : array<f32>;  // [N, N]
@group(0) @binding(3) var<uniform>             params  : Params;
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; let j = gid.y;
  if (i >= params.numNodes || j >= params.numNodes) { return; }
  if (adjMat[i*params.numNodes+j] == 0u) { edgeW[i*params.numNodes+j] = 0.0; return; }
  var dist = 0.0;
  for (var d = 0u; d < params.featDim; d++) {
    let dv = nodeF[i*params.featDim+d] - nodeF[j*params.featDim+d];
    dist += dv * dv;
  }
  edgeW[i*params.numNodes+j] = exp(-dist);
}
