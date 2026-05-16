// ReLU activation in-place
struct Uniforms { size:u32, _p0:u32,_p1:u32,_p2:u32, }
@group(0) @binding(0) var<storage, read_write> x   : array<f32>;
@group(0) @binding(1) var<uniform>             uni : Uniforms;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let i=gid.x; if(i>=uni.size){return;}
  x[i]=max(0.0,x[i]);
}