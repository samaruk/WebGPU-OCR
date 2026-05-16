// densityMap.wgsl — Gaussian-splat keypoint density onto pixel grid
struct Uni { img_w:u32, img_h:u32, kp_count:u32, sigma:f32, radius:u32, _p0:u32, _p1:u32, _p2:u32 };
@group(0) @binding(0) var<uniform>            u      :Uni;
@group(0) @binding(1) var<storage,read>       kps    :array<vec4<f32>>;
@group(0) @binding(2) var<storage,read_write> density:array<f32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.kp_count){return;}
  let kp=kps[gid.x]; let cx=i32(kp.x); let cy=i32(kp.y);
  let inv2=1.0/(2.0*u.sigma*u.sigma); let r=i32(u.radius);
  for(var dy=-r;dy<=r;dy++){
    for(var dx=-r;dx<=r;dx++){
      let nx=cx+dx; let ny=cy+dy;
      if(nx<0||ny<0||u32(nx)>=u.img_w||u32(ny)>=u.img_h){continue;}
      density[u32(ny)*u.img_w+u32(nx)]+=exp(-f32(dx*dx+dy*dy)*inv2);
    }
  }
}
