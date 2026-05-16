
struct Params { width: u32, height: u32, numLabels: u32 }
@group(0) @binding(0) var<storage, read>       labels : array<u32>;
@group(0) @binding(1) var<storage, read_write> adjMat : array<u32>; // [numLabels x numLabels]
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  let W = i32(params.width); let H = i32(params.height);
  if (x >= W || y >= H) { return; }
  let la = labels[u32(y)*u32(W)+u32(x)];
  if (la == 0u) { return; }
  let dx = array<i32,2>(1, 0); let dy = array<i32,2>(0, 1);
  for (var k = 0u; k < 2u; k++) {
    let nx = clamp(x+dx[k], 0, W-1); let ny = clamp(y+dy[k], 0, H-1);
    let lb = labels[u32(ny)*u32(W)+u32(nx)];
    if (lb == 0u || lb == la) { continue; }
    let ai = (la-1u) * params.numLabels + (lb-1u);
    let bi = (lb-1u) * params.numLabels + (la-1u);
    if (ai < params.numLabels*params.numLabels) { adjMat[ai] = 1u; }
    if (bi < params.numLabels*params.numLabels) { adjMat[bi] = 1u; }
  }
}
