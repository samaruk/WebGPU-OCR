// gaussianBlurV.wgsl — vertical separable Gaussian
struct Uni { width:u32, height:u32, radius:u32, _p:u32 };
@group(0) @binding(0) var<uniform>            u  :Uni;
@group(0) @binding(1) var<storage,read>       k  :array<f32>;
@group(0) @binding(2) var<storage,read>       src:array<f32>;
@group(0) @binding(3) var<storage,read_write> dst:array<f32>;
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let r=i32(u.radius); var acc=0.0; var ws=0.0;
  for(var dy=-r;dy<=r;dy++){
    let sy=clamp(i32(gid.y)+dy,0,i32(u.height)-1);
    let ww=k[u32(dy+r)];
    acc+=src[u32(sy)*u.width+gid.x]*ww; ws+=ww;
  }
  dst[gid.y*u.width+gid.x]=acc/ws;
}
