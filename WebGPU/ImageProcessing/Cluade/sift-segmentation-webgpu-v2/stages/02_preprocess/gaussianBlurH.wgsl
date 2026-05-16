// gaussianBlurH.wgsl — horizontal separable Gaussian
struct Uni { width:u32, height:u32, radius:u32, _p:u32 };
@group(0) @binding(0) var<uniform>          u  :Uni;
@group(0) @binding(1) var<storage,read>     k  :array<f32>; // kernel
@group(0) @binding(2) var<storage,read>     src:array<f32>;
@group(0) @binding(3) var<storage,read_write> dst:array<f32>;
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let r=i32(u.radius); var acc=0.0; var ws=0.0;
  for(var dx=-r;dx<=r;dx++){
    let sx=clamp(i32(gid.x)+dx,0,i32(u.width)-1);
    let ww=k[u32(dx+r)];
    acc+=src[u32(gid.y)*u.width+u32(sx)]*ww; ws+=ww;
  }
  dst[gid.y*u.width+gid.x]=acc/ws;
}
