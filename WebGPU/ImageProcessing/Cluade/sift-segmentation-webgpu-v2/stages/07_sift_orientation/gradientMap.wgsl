// gradientMap.wgsl — gradient magnitude and orientation map
struct Uni { width:u32, height:u32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u  :Uni;
@group(0) @binding(1) var<storage,read>       src:array<f32>;
@group(0) @binding(2) var<storage,read_write> mag:array<f32>;
@group(0) @binding(3) var<storage,read_write> ori:array<f32>;
const TWO_PI:f32=6.28318530717959;
fn p(x:i32,y:i32,w:u32,h:u32)->f32{
  return src[u32(clamp(y,0,i32(h)-1))*w+u32(clamp(x,0,i32(w)-1))];
}
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let x=i32(gid.x); let y=i32(gid.y);
  let gx=p(x+1,y,u.width,u.height)-p(x-1,y,u.width,u.height);
  let gy=p(x,y+1,u.width,u.height)-p(x,y-1,u.width,u.height);
  let idx=gid.y*u.width+gid.x;
  mag[idx]=sqrt(gx*gx+gy*gy);
  var a=atan2(gy,gx); if(a<0.0){a+=TWO_PI;} ori[idx]=a;
}
