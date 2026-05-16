// Two-layer FFN: Linear(GELU(Linear(x)))
struct Uniforms { N:u32, D:u32, hidD:u32, _p:u32, }
@group(0) @binding(0) var<storage, read>       inp  : array<f32>;
@group(0) @binding(1) var<storage, read>       W1   : array<f32>;  // [hidD, D]
@group(0) @binding(2) var<storage, read>       b1   : array<f32>;  // [hidD]
@group(0) @binding(3) var<storage, read>       W2   : array<f32>;  // [D, hidD]
@group(0) @binding(4) var<storage, read>       b2   : array<f32>;  // [D]
@group(0) @binding(5) var<storage, read_write> out  : array<f32>;
@group(0) @binding(6) var<uniform>             uni  : Uniforms;
const SQRT2PI:f32=0.7978845608;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let n=gid.x; if(n>=uni.N){return;}
  let D=uni.D; let H=uni.hidD;
  var h=array<f32,2048>();
  for(var hh=0u;hh<H&&hh<2048u;hh++){
    var s=b1[hh]; for(var d=0u;d<D;d++){s+=inp[n*D+d]*W1[hh*D+d];}
    h[hh]=0.5*s*(1.0+tanh(SQRT2PI*(s+0.044715*s*s*s)));
  }
  for(var d=0u;d<D;d++){
    var s=b2[d]; for(var hh=0u;hh<H&&hh<2048u;hh++){s+=h[hh]*W2[d*H+hh];}
    out[n*D+d]=s;
  }
}