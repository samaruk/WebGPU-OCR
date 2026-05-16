// contrastReject.wgsl — discard low-contrast candidates
struct Uni { width:u32, count:u32, thresh:f32, _p:u32 };
@group(0) @binding(0) var<uniform>            u     :Uni;
@group(0) @binding(1) var<storage,read>       dog   :array<f32>;
@group(0) @binding(2) var<storage,read>       kp_in :array<u32>;
@group(0) @binding(3) var<storage,read_write> ctr   :atomic<u32>;
@group(0) @binding(4) var<storage,read_write> kp_out:array<u32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.count){return;}
  let pk=kp_in[gid.x]; let x=pk>>16u; let y=pk&0xFFFFu;
  if(abs(dog[y*u.width+x])>=u.thresh){
    kp_out[atomicAdd(&ctr,1u)]=pk;
  }
}
