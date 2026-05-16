// textureUpload.wgsl — rgba8 sampled texture → r32float storage buffer (BT.709 lum)
@group(0) @binding(0) var src_tex  : texture_2d<f32>;
@group(0) @binding(1) var<storage,read_write> dst : array<f32>;
struct Uni { width:u32, height:u32, _p0:u32, _p1:u32 };
@group(0) @binding(2) var<uniform> u : Uni;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let c = textureLoad(src_tex,vec2<i32>(gid.xy),0);
  let lin = pow(clamp(c.rgb,vec3<f32>(0.0),vec3<f32>(1.0)),vec3<f32>(2.2));
  dst[gid.y*u.width+gid.x] = dot(lin,vec3<f32>(0.2126,0.7152,0.0722));
}
