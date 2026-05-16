
struct Params { N: u32 }
@group(0) @binding(0) var<storage, read>       bboxes : array<f32>;   // [N,4]
@group(0) @binding(1) var<storage, read_write> order  : array<u32>;   // sorted indices
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.N) { return; }
  // Sort key: y0 * 10000 + x0
  let y0 = bboxes[n*4u+1u]; let x0 = bboxes[n*4u];
  let key = u32(y0 * 10000.0 + x0);
  var rank = 0u;
  for (var j = 0u; j < params.N; j++) {
    let jy = bboxes[j*4u+1u]; let jx = bboxes[j*4u];
    let jkey = u32(jy * 10000.0 + jx);
    if (jkey < key || (jkey == key && j < n)) { rank += 1u; }
  }
  if (rank < params.N) { order[rank] = n; }
}
