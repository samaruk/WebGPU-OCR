
struct Params { W: u32, H: u32, gap: u32 }
@group(0) @binding(0) var<storage, read>       linesIn  : array<f32>;
@group(0) @binding(1) var<storage, read_write> linesOut : array<f32>;
@group(0) @binding(2) var<uniform>             params   : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.W || y >= params.H) { return; }
  let i = y * params.W + x;
  if (linesIn[i] > 0.5) { linesOut[i] = 1.0; return; }
  // Fill small gaps
  var hasLeft = false; var hasRight = false;
  for (var k = 1u; k <= params.gap; k++) {
    if (x >= k && linesIn[y*params.W+(x-k)] > 0.5) { hasLeft = true; }
    if (x+k < params.W && linesIn[y*params.W+(x+k)] > 0.5) { hasRight = true; }
  }
  linesOut[i] = select(0.0, 1.0, hasLeft && hasRight);
}
