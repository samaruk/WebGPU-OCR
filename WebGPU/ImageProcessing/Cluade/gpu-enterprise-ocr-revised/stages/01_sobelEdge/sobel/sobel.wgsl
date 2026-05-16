
// 2 bindings only — uniform removed because textureDimensions() is used for bounds.
@group(0) @binding(0) var inputTex : texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm,write>;

fn lum(p:vec2<i32>)->f32{
  let d=vec2<i32>(textureDimensions(inputTex));
  let s=textureLoad(inputTex,clamp(p,vec2<i32>(0),d-vec2<i32>(1)),0);
  return dot(s.rgb,vec3<f32>(.299,.587,.114));
}
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let d=textureDimensions(outputTex);
  if(gid.x>=d.x||gid.y>=d.y){return;}
  let x=i32(gid.x);let y=i32(gid.y);
  let tl=lum(vec2<i32>(x-1,y-1));let tm=lum(vec2<i32>(x,y-1));let tr=lum(vec2<i32>(x+1,y-1));
  let ml=lum(vec2<i32>(x-1,y));               let mr=lum(vec2<i32>(x+1,y));
  let bl=lum(vec2<i32>(x-1,y+1));let bm=lum(vec2<i32>(x,y+1));let br=lum(vec2<i32>(x+1,y+1));
  let gx=-tl+tr-2.*ml+2.*mr-bl+br;
  let gy=-tl-2.*tm-tr+bl+2.*bm+br;
  let mag=clamp(sqrt(gx*gx+gy*gy)*2.,0.,1.);
  textureStore(outputTex,vec2<i32>(gid.xy),vec4<f32>(mag,mag,mag,1.));
}
