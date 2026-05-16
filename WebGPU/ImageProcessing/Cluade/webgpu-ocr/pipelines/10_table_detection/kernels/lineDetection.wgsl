
// Hough-like horizontal/vertical line detection
struct Params { W: u32, H: u32, minLen: u32, orient: u32 }
@group(0) @binding(0) var<storage, read>       edges  : array<f32>;
@group(0) @binding(1) var<storage, read_write> lines  : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.W || y >= params.H) { return; }
  let i = y * params.W + x;
  if (edges[i] < 0.3) { lines[i] = 0.0; return; }
  var runLen = 0u;
  let ml = params.minLen;
  if (params.orient == 0u) { // horizontal
    for (var kx = 0u; kx < ml; kx++) {
      let nx = min(x + kx, params.W-1u);
      if (edges[y*params.W+nx] > 0.3) { runLen++; }
    }
  } else { // vertical
    for (var ky = 0u; ky < ml; ky++) {
      let ny = min(y + ky, params.H-1u);
      if (edges[ny*params.W+x] > 0.3) { runLen++; }
    }
  }
  lines[i] = select(0.0, 1.0, runLen >= ml);
}
