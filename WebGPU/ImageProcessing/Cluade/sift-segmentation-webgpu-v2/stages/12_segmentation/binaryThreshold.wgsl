// binaryThreshold.wgsl
struct Uni { n:u32, thresh:f32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u :Uni;
@group(0) @binding(1) var<storage,read>       src:array<f32>;
@group(0) @binding(2) var<storage,read_write> dst:array<u32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.n){return;} dst[gid.x]=select(0u,1u,src[gid.x]>=u.thresh);
}
