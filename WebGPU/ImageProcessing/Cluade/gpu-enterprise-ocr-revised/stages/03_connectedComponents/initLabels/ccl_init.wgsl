
@group(0) @binding(0) var binaryTex:texture_2d<f32>;
@group(0) @binding(1) var<storage,read_write> labels:array<u32>;
@group(0) @binding(2) var<uniform> u:vec4<u32>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  if(gid.x>=u.x||gid.y>=u.y){return;}
  let idx=gid.y*u.x+gid.x;
  let val=textureLoad(binaryTex,vec2<i32>(gid.xy),0).r;
  labels[idx]=select(0u,idx+1u,val>0.5);
}
