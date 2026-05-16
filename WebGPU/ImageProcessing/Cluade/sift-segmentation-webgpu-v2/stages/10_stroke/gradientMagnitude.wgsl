// gradientMagnitude.wgsl — Sobel edge detector
struct Uni { width:u32, height:u32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u  :Uni;
@group(0) @binding(1) var<storage,read>       src:array<f32>;
@group(0) @binding(2) var<storage,read_write> mag:array<f32>;
@group(0) @binding(3) var<storage,read_write> ang:array<f32>;
const PI:f32=3.14159265358979;
fn p(x:i32,y:i32,w:u32,h:u32)->f32{
  return src[u32(clamp(y,0,i32(h)-1))*w+u32(clamp(x,0,i32(w)-1))];
}
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let x=i32(gid.x); let y=i32(gid.y); let w=u.width; let h=u.height;
  let gx=-p(x-1,y-1,w,h)-2.0*p(x-1,y,w,h)-p(x-1,y+1,w,h)+p(x+1,y-1,w,h)+2.0*p(x+1,y,w,h)+p(x+1,y+1,w,h);
  let gy=-p(x-1,y-1,w,h)-2.0*p(x,y-1,w,h)-p(x+1,y-1,w,h)+p(x-1,y+1,w,h)+2.0*p(x,y+1,w,h)+p(x+1,y+1,w,h);
  let idx=gid.y*w+gid.x;
  mag[idx]=sqrt(gx*gx+gy*gy);
  var a=atan2(gy,gx); if(a<0.0){a+=PI;} ang[idx]=a;
}
