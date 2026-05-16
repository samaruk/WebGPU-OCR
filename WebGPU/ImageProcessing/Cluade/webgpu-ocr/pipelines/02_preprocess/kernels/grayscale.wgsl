
struct Params { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read>       rgba   : array<f32>;
@group(0) @binding(1) var<storage, read_write> gray   : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }
  let i = y * params.width + x;
  let r = rgba[i*4u];
  let g = rgba[i*4u+1u];
  let b = rgba[i*4u+2u];
  gray[i] = 0.299*r + 0.587*g + 0.114*b;
}
