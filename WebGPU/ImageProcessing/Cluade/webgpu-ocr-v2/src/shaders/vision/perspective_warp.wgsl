// Inverse perspective warp for crop rectification
struct Uniforms {
  srcW:u32, srcH:u32, dstW:u32, dstH:u32,
  h00:f32,h01:f32,h02:f32,
  h10:f32,h11:f32,h12:f32,
  h20:f32,h21:f32,h22:f32,
  _p:u32,
}
@group(0) @binding(0) var<storage, read>       src : array<f32>;   // [H,W] grayscale
@group(0) @binding(1) var<storage, read_write> dst : array<f32>;   // [dstH,dstW]
@group(0) @binding(2) var<uniform>             uni : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let x=gid.x; let y=gid.y;
  if(x>=uni.dstW||y>=uni.dstH){return;}
  let fx=f32(x); let fy=f32(y);
  let d  = uni.h20*fx + uni.h21*fy + uni.h22;
  let sx = (uni.h00*fx + uni.h01*fy + uni.h02) / d;
  let sy = (uni.h10*fx + uni.h11*fy + uni.h12) / d;
  // Bilinear sample
  let x0=i32(floor(sx)); let y0=i32(floor(sy));
  let fx2=sx-f32(x0); let fy2=sy-f32(y0);
  let W=uni.srcW; let H=uni.srcH;
  let q00=src[u32(clamp(y0  ,0,i32(H)-1))*W+u32(clamp(x0  ,0,i32(W)-1))];
  let q10=src[u32(clamp(y0  ,0,i32(H)-1))*W+u32(clamp(x0+1,0,i32(W)-1))];
  let q01=src[u32(clamp(y0+1,0,i32(H)-1))*W+u32(clamp(x0  ,0,i32(W)-1))];
  let q11=src[u32(clamp(y0+1,0,i32(H)-1))*W+u32(clamp(x0+1,0,i32(W)-1))];
  dst[y*uni.dstW+x] = q00*(1.-fx2)*(1.-fy2)+q10*fx2*(1.-fy2)+q01*(1.-fx2)*fy2+q11*fx2*fy2;
}