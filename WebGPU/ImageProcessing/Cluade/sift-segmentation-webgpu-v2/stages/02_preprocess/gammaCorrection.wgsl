// gammaCorrection.wgsl
struct Uni { width:u32, height:u32, gamma:f32, _p:u32 };
@group(0) @binding(0) var<uniform>            u  :Uni;
@group(0) @binding(1) var<storage,read>       src:array<f32>;
@group(0) @binding(2) var<storage,read_write> dst:array<f32>;
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  dst[gid.y*u.width+gid.x]=pow(clamp(src[gid.y*u.width+gid.x],0.0,1.0),1.0/u.gamma);
}
