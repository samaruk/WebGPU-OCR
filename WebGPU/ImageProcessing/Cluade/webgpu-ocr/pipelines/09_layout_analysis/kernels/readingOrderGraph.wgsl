
// Build reading-order edges: left-to-right, top-to-bottom
struct Params { N: u32 }
@group(0) @binding(0) var<storage, read>       bboxes : array<f32>;   // [N, 4] = x0,y0,x1,y1
@group(0) @binding(1) var<storage, read_write> edges  : array<i32>;   // [N] → successor idx
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.N) { return; }
  let x0 = bboxes[n*4u]; let y0 = bboxes[n*4u+1u];
  let x1 = bboxes[n*4u+2u]; let y1 = bboxes[n*4u+3u];
  var bestJ = -1i; var bestScore = 1e30;
  for (var j = 0u; j < params.N; j++) {
    if (j == n) { continue; }
    let jx0 = bboxes[j*4u]; let jy0 = bboxes[j*4u+1u];
    // Score: same row preferred, then next row
    let dy = jy0 - y0; let dx = jx0 - x1;
    if (dy >= -5.0 && dx >= 0.0) {
      let score = dy * 1000.0 + dx;
      if (score < bestScore) { bestScore = score; bestJ = i32(j); }
    }
  }
  edges[n] = bestJ;
}
