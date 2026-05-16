// Scaled dot-product multi-head attention
// Q[N,D], K[M,D], V[M,D] → out[N,D]
struct Uniforms { N:u32, M:u32, D:u32, numHeads:u32, scale:f32, _p0:u32,_p1:u32,_p2:u32, }
@group(0) @binding(0) var<storage, read>       Q   : array<f32>;
@group(0) @binding(1) var<storage, read>       K   : array<f32>;
@group(0) @binding(2) var<storage, read>       V   : array<f32>;
@group(0) @binding(3) var<storage, read_write> out : array<f32>;
@group(0) @binding(4) var<uniform>             uni : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let i=gid.x; let d=gid.y;
  let N=uni.N; let M=uni.M; let D=uni.D;
  if(i>=N||d>=D){return;}
  // Compute attention scores for row i
  var maxS=-1e9;
  for(var j=0u;j<M;j++){
    var s=0.0; for(var k=0u;k<D;k++){s+=Q[i*D+k]*K[j*D+k];}
    maxS=max(maxS,s*uni.scale);
  }
  var sumE=0.0;
  var scores=array<f32,512>();
  for(var j=0u;j<M&&j<512u;j++){
    var s=0.0; for(var k=0u;k<D;k++){s+=Q[i*D+k]*K[j*D+k];}
    scores[j]=exp(s*uni.scale-maxS); sumE+=scores[j];
  }
  var v=0.0;
  for(var j=0u;j<M&&j<512u;j++){v+=scores[j]/sumE*V[j*D+d];}
  out[i*D+d]=v;
}