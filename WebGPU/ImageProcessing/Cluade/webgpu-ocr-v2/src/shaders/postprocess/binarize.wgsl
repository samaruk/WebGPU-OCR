// DB differentiable binarization: B = sigmoid(k*(P-T))
struct Uniforms { width:u32, height:u32, k:f32, _p:u32, }
@group(0) @binding(0) var<storage, read>       probMap   : array<f32>;
@group(0) @binding(1) var<storage, read>       threshMap : array<f32>;
@group(0) @binding(2) var<storage, read_write> binMap    : array<f32>;
@group(0) @binding(3) var<uniform>             uni       : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let x=gid.x; let y=gid.y;
  if(x>=uni.width||y>=uni.height){return;}
  let idx=y*uni.width+x;
  let p=probMap[idx]; let t=threshMap[idx];
  binMap[idx]=1.0/(1.0+exp(-uni.k*(p-t)));
}