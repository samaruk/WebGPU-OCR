// strokeWidth.wgsl — Stroke Width Transform (ray casting)
struct Uni { width:u32, height:u32, max_steps:u32, max_w:f32, min_w:f32, _p0:u32, _p1:u32, _p2:u32 };
@group(0) @binding(0) var<uniform>            u  :Uni;
@group(0) @binding(1) var<storage,read>       mag:array<f32>;
@group(0) @binding(2) var<storage,read>       ang:array<f32>;
@group(0) @binding(3) var<storage,read_write> swt:array<f32>;
const EDGE_T:f32=0.1; const PI:f32=3.14159265358979;
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let idx=gid.y*u.width+gid.x;
  if(mag[idx]<EDGE_T){swt[idx]=u.max_w;return;}
  let a0=ang[idx]; let dx=cos(a0); let dy=sin(a0);
  var width=u.max_w;
  for(var s=1u;s<=u.max_steps;s++){
    let t=f32(s);
    let nx=i32(gid.x)+i32(t*dx); let ny=i32(gid.y)+i32(t*dy);
    if(nx<0||ny<0||u32(nx)>=u.width||u32(ny)>=u.height){break;}
    let ni=u32(ny)*u.width+u32(nx);
    if(mag[ni]>=EDGE_T){
      if(abs(cos(a0-ang[ni]+PI))>0.8){width=t;break;}
    }
    if(t>u.max_w){break;}
  }
  swt[idx]=clamp(width,u.min_w,u.max_w);
}
