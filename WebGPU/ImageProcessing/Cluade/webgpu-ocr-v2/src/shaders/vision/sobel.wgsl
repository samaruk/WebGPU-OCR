// Sobel edge detector → gradient magnitude + angle
struct Uniforms { width:u32, height:u32, _p0:u32, _p1:u32, }
@group(0) @binding(0) var<storage, read>       input : array<f32>;
@group(0) @binding(1) var<storage, read_write> mag   : array<f32>;
@group(0) @binding(2) var<storage, read_write> angle : array<f32>;
@group(0) @binding(3) var<uniform>             uni   : Uniforms;

fn s(x:i32, y:i32) -> f32 {
  let W=uni.width; let H=uni.height;
  let cx=clamp(x,0,i32(W)-1); let cy=clamp(y,0,i32(H)-1);
  return input[u32(cy)*W+u32(cx)];
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let x=gid.x; let y=gid.y;
  if(x>=uni.width||y>=uni.height){return;}
  let ix=i32(x); let iy=i32(y);
  let gx = -s(ix-1,iy-1) + s(ix+1,iy-1)
          + -2.0*s(ix-1,iy) + 2.0*s(ix+1,iy)
          + -s(ix-1,iy+1) + s(ix+1,iy+1);
  let gy = -s(ix-1,iy-1) - 2.0*s(ix,iy-1) - s(ix+1,iy-1)
          +  s(ix-1,iy+1) + 2.0*s(ix,iy+1) + s(ix+1,iy+1);
  mag[y*uni.width+x]   = sqrt(gx*gx + gy*gy);
  angle[y*uni.width+x] = atan2(gy, gx);
}