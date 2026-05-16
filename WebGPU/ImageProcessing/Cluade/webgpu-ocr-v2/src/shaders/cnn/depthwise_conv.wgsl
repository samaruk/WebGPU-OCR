// Depthwise separable convolution (each channel independently)
struct Uniforms { W:u32,H:u32,C:u32,kR:u32,strideH:u32,strideW:u32,padH:u32,padW:u32, }
@group(0) @binding(0) var<storage, read>       inp  : array<f32>;
@group(0) @binding(1) var<storage, read_write> out  : array<f32>;
@group(0) @binding(2) var<storage, read>       kern : array<f32>;  // [C, 2R+1, 2R+1]
@group(0) @binding(3) var<storage, read>       bias : array<f32>;  // [C]
@group(0) @binding(4) var<uniform>             uni  : Uniforms;
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let ox=gid.x; let oy=gid.y; let c=gid.z;
  let outW=(uni.W+uni.strideW-1u)/uni.strideW;
  let outH=(uni.H+uni.strideH-1u)/uni.strideH;
  if(ox>=outW||oy>=outH||c>=uni.C){return;}
  let K=2u*uni.kR+1u; let N=uni.W*uni.H;
  var sum=bias[c];
  for(var ky=0u;ky<K;ky++){for(var kx=0u;kx<K;kx++){
    let iy=i32(oy*uni.strideH+ky)-i32(uni.padH);
    let ix=i32(ox*uni.strideW+kx)-i32(uni.padW);
    if(iy>=0&&ix>=0&&u32(iy)<uni.H&&u32(ix)<uni.W){
      sum+=kern[c*K*K+ky*K+kx]*inp[c*N+u32(iy)*uni.W+u32(ix)];
    }
  }}
  out[c*outW*outH+oy*outW+ox]=sum;
}