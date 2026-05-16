// Numerically stable row-wise softmax (in-place)
struct Uniforms { rows:u32, cols:u32, _p0:u32, _p1:u32, }
@group(0) @binding(0) var<storage, read_write> x   : array<f32>;
@group(0) @binding(1) var<uniform>             uni : Uniforms;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let r=gid.x; if(r>=uni.rows){return;}
  let C=uni.cols; let base=r*C;
  var maxV=-1e38;
  for(var c=0u;c<C;c++){maxV=max(maxV,x[base+c]);}
  var sumE=0.0;
  for(var c=0u;c<C;c++){x[base+c]=exp(x[base+c]-maxV);sumE+=x[base+c];}
  let inv=1.0/(sumE+1e-10);
  for(var c=0u;c<C;c++){x[base+c]*=inv;}
}