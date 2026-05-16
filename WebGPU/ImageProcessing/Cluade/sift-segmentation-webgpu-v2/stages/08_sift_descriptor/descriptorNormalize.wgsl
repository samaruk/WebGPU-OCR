// descriptorNormalize.wgsl — L2-norm, clamp at 0.2, re-normalize
struct Uni { kp_count:u32, mag_thr:f32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u    :Uni;
@group(0) @binding(1) var<storage,read_write> desc :array<f32>;
var<workgroup> smem:array<f32,128>;
@compute @workgroup_size(128,1,1)
fn main(@builtin(workgroup_id) wid:vec3<u32>, @builtin(local_invocation_index) lid:u32) {
  if(wid.x>=u.kp_count){return;}
  let base=wid.x*128u; let v=desc[base+lid];
  smem[lid]=v*v; workgroupBarrier();
  for(var s=64u;s>=1u;s>>=1u){if(lid<s){smem[lid]+=smem[lid+s];}workgroupBarrier();}
  let n1=sqrt(smem[0])+1e-7; var vn=v/n1; vn=min(vn,u.mag_thr);
  smem[lid]=vn*vn; workgroupBarrier();
  for(var s=64u;s>=1u;s>>=1u){if(lid<s){smem[lid]+=smem[lid+s];}workgroupBarrier();}
  desc[base+lid]=vn/(sqrt(smem[0])+1e-7);
}
