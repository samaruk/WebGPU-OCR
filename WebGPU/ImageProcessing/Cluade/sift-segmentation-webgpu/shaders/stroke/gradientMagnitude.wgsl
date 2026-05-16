// shaders/stroke/gradientMagnitude.wgsl — Sobel gradient magnitude

struct Uniforms { width:u32, height:u32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u   : Uniforms;
@group(0) @binding(1) var<storage,read>       src : array<f32>;
@group(0) @binding(2) var<storage,read_write> mag : array<f32>;
@group(0) @binding(3) var<storage,read_write> ang : array<f32>; // [0,π)

const PI:f32 = 3.14159265;

fn p(x:i32,y:i32)->f32{
  let cx=clamp(x,0,i32(u.width)-1); let cy=clamp(y,0,i32(u.height)-1);
  return src[u32(cy*i32(u.width)+cx)];
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x>=u.width||gid.y>=u.height) { return; }
  let x=i32(gid.x); let y=i32(gid.y);
  let gx = -p(x-1,y-1) - 2.0*p(x-1,y) - p(x-1,y+1) + p(x+1,y-1) + 2.0*p(x+1,y) + p(x+1,y+1);
  let gy = -p(x-1,y-1) - 2.0*p(x,y-1) - p(x+1,y-1) + p(x-1,y+1) + 2.0*p(x,y+1) + p(x+1,y+1);
  let idx = gid.y*u.width + gid.x;
  mag[idx] = sqrt(gx*gx+gy*gy);
  var a = atan2(gy, gx);
  if (a < 0.0) { a += PI; }
  ang[idx] = a;
}
