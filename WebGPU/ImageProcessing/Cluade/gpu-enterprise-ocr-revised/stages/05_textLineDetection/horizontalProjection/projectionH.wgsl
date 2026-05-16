
@group(0) @binding(0) var binaryTex:texture_2d<f32>;
@group(0) @binding(1) var<storage,read_write> projection:array<u32>;
@group(0) @binding(2) var<uniform> u:vec4<u32>;
@compute @workgroup_size(1,256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let row=gid.y;if(row>=u.y){return;}
  var sum:u32=0u;
  for(var col:u32=0u;col<u.x;col++){
    if(textureLoad(binaryTex,vec2<i32>(i32(col),i32(row)),0).r>0.5){sum++;}
  }
  projection[row]=sum;
}
