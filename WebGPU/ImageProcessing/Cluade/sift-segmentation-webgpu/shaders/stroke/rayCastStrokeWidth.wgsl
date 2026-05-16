// shaders/stroke/rayCastStrokeWidth.wgsl — Stroke Width Transform via ray casting

struct Uniforms {
  width      : u32,
  height     : u32,
  max_steps  : u32,
  max_width  : f32,
  min_width  : f32,
  _pad0:u32, _pad1:u32, _pad2:u32,
};
@group(0) @binding(0) var<uniform>            u    : Uniforms;
@group(0) @binding(1) var<storage,read>       mag  : array<f32>;
@group(0) @binding(2) var<storage,read>       ang  : array<f32>;
@group(0) @binding(3) var<storage,read_write> swt  : array<f32>;

const EDGE_THRESH : f32 = 0.1;
const PI          : f32 = 3.14159265;

fn pidx(x:i32,y:i32)->u32{
  return u32(clamp(y,0,i32(u.height)-1))*u.width + u32(clamp(x,0,i32(u.width)-1));
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x>=u.width||gid.y>=u.height) { return; }
  let idx = gid.y*u.width + gid.x;
  if (mag[idx] < EDGE_THRESH) { swt[idx] = u.max_width; return; }

  let a0 = ang[idx];
  let dx = cos(a0); let dy = sin(a0);
  var t  = 1.0;
  var width = u.max_width;
  for (var s=0u; s<u.max_steps; s++) {
    let nx = i32(gid.x) + i32(t*dx);
    let ny = i32(gid.y) + i32(t*dy);
    if (nx<0||ny<0||u32(nx)>=u.width||u32(ny)>=u.height) { break; }
    let ni = u32(ny)*u.width + u32(nx);
    if (mag[ni] >= EDGE_THRESH) {
      // Check opposite direction
      let a1 = ang[ni];
      if (abs(cos(a0 - a1 + PI)) > 0.8) {
        width = t; break;
      }
    }
    t += 1.0;
    if (t > u.max_width) { break; }
  }
  swt[idx] = clamp(width, u.min_width, u.max_width);
}
