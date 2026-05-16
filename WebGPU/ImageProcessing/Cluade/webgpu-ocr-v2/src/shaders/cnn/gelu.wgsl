// GELU activation in-place: 0.5x(1+tanh(sqrt(2/pi)(x+0.044715x^3)))
struct Uniforms { size:u32, _p0:u32,_p1:u32,_p2:u32, }
@group(0) @binding(0) var<storage, read_write> x   : array<f32>;
@group(0) @binding(1) var<uniform>             uni : Uniforms;
const SQRT2PI:f32 = 0.7978845608028654;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let i=gid.x; if(i>=uni.size){return;}
  let v=x[i];
  x[i]=0.5*v*(1.0+tanh(SQRT2PI*(v+0.044715*v*v*v)));
}