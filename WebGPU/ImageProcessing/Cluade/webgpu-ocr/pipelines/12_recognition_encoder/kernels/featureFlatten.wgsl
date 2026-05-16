
// Flatten [C, H, W] → [W, C*H] for sequence input to transformer
struct Params { C: u32, H: u32, W: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let t = gid.x;   // time step = column index
  let d = gid.y;   // feature dim index
  if (t >= params.W || d >= params.C * params.H) { return; }
  let c = d / params.H; let h = d % params.H;
  output[t * (params.C * params.H) + d] = input[(c * params.H + h) * params.W + t];
}
