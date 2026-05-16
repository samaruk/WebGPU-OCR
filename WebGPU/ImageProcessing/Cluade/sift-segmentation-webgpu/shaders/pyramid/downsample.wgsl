// shaders/pyramid/downsample.wgsl — 2× average downsample for octave transition

struct Uniforms { src_w:u32, src_h:u32, dst_w:u32, dst_h:u32 };
@group(0) @binding(0) var<uniform>         u   : Uniforms;
@group(0) @binding(1) var<storage,read>    src : array<f32>;
@group(0) @binding(2) var<storage,read_write> dst : array<f32>;

fn pix(x:i32,y:i32)->f32{
  let cx=clamp(x,0,i32(u.src_w)-1); let cy=clamp(y,0,i32(u.src_h)-1);
  return src[u32(cy*i32(u.src_w)+cx)];
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.dst_w || gid.y >= u.dst_h) { return; }
  let sx = i32(gid.x) * 2;
  let sy = i32(gid.y) * 2;
  let v  = (pix(sx,sy) + pix(sx+1,sy) + pix(sx,sy+1) + pix(sx+1,sy+1)) * 0.25;
  dst[gid.y * u.dst_w + gid.x] = v;
}
