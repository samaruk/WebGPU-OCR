
struct Params { W: u32, H: u32 }
@group(0) @binding(0) var<storage, read>       hLines : array<f32>;
@group(0) @binding(1) var<storage, read>       vLines : array<f32>;
@group(0) @binding(2) var<storage, read_write> grid   : array<f32>;
@group(0) @binding(3) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.W || y >= params.H) { return; }
  let i = y * params.W + x;
  grid[i] = max(hLines[i], vLines[i]);
}
