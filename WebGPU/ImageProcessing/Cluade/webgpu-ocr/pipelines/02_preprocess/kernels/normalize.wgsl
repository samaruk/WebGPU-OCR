
struct Params {
  width: u32, height: u32,
  mean_r: f32, mean_g: f32, mean_b: f32,
  std_r:  f32, std_g:  f32, std_b:  f32,
}
@group(0) @binding(0) var<storage, read>       input  : array<f32>;  // RGBA interleaved
@group(0) @binding(1) var<storage, read_write> output : array<f32>;  // RGBA interleaved
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }
  let i = (y * params.width + x) * 4u;
  output[i  ] = (input[i  ] - params.mean_r) / params.std_r;
  output[i+1u] = (input[i+1u] - params.mean_g) / params.std_g;
  output[i+2u] = (input[i+2u] - params.mean_b) / params.std_b;
  output[i+3u] = input[i+3u];
}
