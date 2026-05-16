// 2D convolution with stride and padding
struct Uniforms {
  inW:u32,inH:u32,outW:u32,outH:u32,
  inC:u32,outC:u32,kH:u32,kW:u32,
  strideH:u32,strideW:u32,padH:u32,padW:u32,
}
@group(0) @binding(0) var<storage, read>       inp  : array<f32>;  // [inC,inH,inW]
@group(0) @binding(1) var<storage, read_write> out  : array<f32>;  // [outC,outH,outW]
@group(0) @binding(2) var<storage, read>       kern : array<f32>;  // [outC,inC,kH,kW]
@group(0) @binding(3) var<storage, read>       bias : array<f32>;  // [outC]
@group(0) @binding(4) var<uniform>             uni  : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let ox=gid.x; let oy=gid.y; let oc=gid.z;
  if(ox>=uni.outW||oy>=uni.outH||oc>=uni.outC){return;}
  let inN=uni.inW*uni.inH; let outN=uni.outW*uni.outH;
  var sum=bias[oc];
  for(var ic=0u;ic<uni.inC;ic++){
    for(var ky=0u;ky<uni.kH;ky++){for(var kx=0u;kx<uni.kW;kx++){
      let iy=i32(oy*uni.strideH+ky)-i32(uni.padH);
      let ix=i32(ox*uni.strideW+kx)-i32(uni.padW);
      if(iy>=0&&ix>=0&&u32(iy)<uni.inH&&u32(ix)<uni.inW){
        let wIdx=oc*uni.inC*uni.kH*uni.kW+ic*uni.kH*uni.kW+ky*uni.kW+kx;
        sum+=kern[wIdx]*inp[ic*inN+u32(iy)*uni.inW+u32(ix)];
      }
    }}
  }
  out[oc*outN+oy*uni.outW+ox]=sum;
}