// Layer normalization: (x-mean)/std * gamma + beta
struct Uniforms { N:u32, D:u32, eps:f32, _p:u32, }
@group(0) @binding(0) var<storage, read_write> x     : array<f32>;
@group(0) @binding(1) var<storage, read>       gamma : array<f32>;
@group(0) @binding(2) var<storage, read>       beta  : array<f32>;
@group(0) @binding(3) var<uniform>             uni   : Uniforms;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let n=gid.x; if(n>=uni.N){return;}
  let D=uni.D; let base=n*D;
  var mean=0.0; for(var d=0u;d<D;d++){mean+=x[base+d];} mean/=f32(D);
  var v2=0.0;   for(var d=0u;d<D;d++){let e=x[base+d]-mean;v2+=e*e;} v2/=f32(D);
  let istd=1.0/sqrt(v2+uni.eps);
  for(var d=0u;d<D;d++){x[base+d]=gamma[d]*(x[base+d]-mean)*istd+beta[d];}
}