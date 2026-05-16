
struct Params { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read>       labelIn  : array<u32>;
@group(0) @binding(1) var<storage, read_write> labelOut : array<f32>;
@group(0) @binding(2) var<uniform>             params   : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }
  let i = y * params.width + x;
  let l = labelIn[i];
  labelOut[i] = select(0.0, f32(l % 256u + 1u) / 256.0, l > 0u);
}
