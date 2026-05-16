
struct Params { W: u32, H: u32, C: u32, numNodes: u32 }
@group(0) @binding(0) var<storage, read>       featMap : array<f32>;  // [C,H,W]
@group(0) @binding(1) var<storage, read>       labels  : array<u32>;  // [H,W]
@group(0) @binding(2) var<storage, read_write> nodeF   : array<f32>;  // [numNodes, C]
@group(0) @binding(3) var<storage, read_write> nodeCnt : array<u32>;  // [numNodes]
@group(0) @binding(4) var<uniform>             params  : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.W || y >= params.H) { return; }
  let l = labels[y*params.W+x];
  if (l == 0u || l > params.numNodes) { return; }
  let n = l - 1u;
  for (var c = 0u; c < params.C; c++) {
    nodeF[n*params.C+c] += featMap[(c*params.H+y)*params.W+x];
  }
  nodeCnt[n] += 1u;
}
