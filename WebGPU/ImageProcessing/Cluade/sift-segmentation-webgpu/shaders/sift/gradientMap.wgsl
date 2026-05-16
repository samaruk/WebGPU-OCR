// shaders/sift/gradientMap.wgsl — Compute per-pixel gradient magnitude & orientation

struct Uniforms { width:u32, height:u32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u    : Uniforms;
@group(0) @binding(1) var<storage,read>       src  : array<f32>;
@group(0) @binding(2) var<storage,read_write> mag  : array<f32>;
@group(0) @binding(3) var<storage,read_write> ori  : array<f32>; // radians [0,2π)

const TWO_PI : f32 = 6.283185307;

fn pix(x:i32,y:i32)->f32{
  let cx=clamp(x,0,i32(u.width)-1); let cy=clamp(y,0,i32(u.height)-1);
  return src[u32(cy*i32(u.width)+cx)];
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x  = i32(gid.x); let y = i32(gid.y);
  let gx = pix(x+1,y) - pix(x-1,y);
  let gy = pix(x,y+1) - pix(x,y-1);
  let m  = sqrt(gx*gx + gy*gy);
  var a  = atan2(gy, gx);
  if (a < 0.0) { a += TWO_PI; }
  let idx = gid.y * u.width + gid.x;
  mag[idx] = m;
  ori[idx] = a;
}
