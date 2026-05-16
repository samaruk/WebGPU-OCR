
struct Params { width: u32, height: u32, angle: f32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

const PI = 3.14159265358979;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = gid.x; let dy = gid.y;
  if (dx >= params.width || dy >= params.height) { return; }
  let rad  = params.angle * PI / 180.0;
  let cosA = cos(rad); let sinA = sin(rad);
  let cx = f32(params.width) * 0.5; let cy = f32(params.height) * 0.5;
  let rx = f32(dx) - cx; let ry = f32(dy) - cy;
  let sx_f = cosA * rx + sinA * ry + cx;
  let sy_f = -sinA * rx + cosA * ry + cy;
  let sx = i32(round(sx_f)); let sy = i32(round(sy_f));
  var val = 1.0; // white background
  if (sx >= 0 && sx < i32(params.width) && sy >= 0 && sy < i32(params.height)) {
    val = input[u32(sy)*params.width + u32(sx)];
  }
  output[dy*params.width+dx] = val;
}
