// Batch norm inference (fused scale+shift)
struct Uniforms { N:u32, C:u32, H:u32, W:u32, eps:f32, _p0:u32,_p1:u32,_p2:u32, }
@group(0) @binding(0) var<storage, read_write> x     : array<f32>;  // [C,H,W]
@group(0) @binding(1) var<storage, read>       gamma : array<f32>;  // [C] scale
@group(0) @binding(2) var<storage, read>       beta  : array<f32>;  // [C] shift
@group(0) @binding(3) var<storage, read>       mean  : array<f32>;  // [C] running mean
@group(0) @binding(4) var<storage, read>       var_  : array<f32>;  // [C] running var
@group(0) @binding(5) var<uniform>             uni   : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let ix=gid.x; let iy=gid.y; let c=gid.z;
  if(ix>=uni.W||iy>=uni.H||c>=uni.C){return;}
  let idx=c*uni.H*uni.W+iy*uni.W+ix;
  let xhat=(x[idx]-mean[c])/sqrt(var_[c]+uni.eps);
  x[idx]=gamma[c]*xhat+beta[c];
}