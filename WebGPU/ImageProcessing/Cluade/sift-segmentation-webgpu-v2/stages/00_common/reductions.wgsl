// reductions.wgsl — workgroup reduction helpers
var<workgroup> _smem: array<f32,256>;
fn wg_sum(lid:u32, val:f32)->f32{
  _smem[lid]=val; workgroupBarrier();
  for(var s=128u;s>=1u;s>>=1u){ if(lid<s){_smem[lid]+=_smem[lid+s];} workgroupBarrier(); }
  return _smem[0];
}
fn wg_max(lid:u32, val:f32)->f32{
  _smem[lid]=val; workgroupBarrier();
  for(var s=128u;s>=1u;s>>=1u){ if(lid<s){_smem[lid]=max(_smem[lid],_smem[lid+s]);} workgroupBarrier(); }
  return _smem[0];
}
