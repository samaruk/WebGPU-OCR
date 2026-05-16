
@group(0)@binding(0) var binaryTex:texture_2d<f32>;
@group(0)@binding(1) var<storage,read_write> projection:array<u32>;
@group(0)@binding(2) var<uniform> u:vec4<u32>;
@compute @workgroup_size(256,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let col=gid.x;if(col>=u.x){return;}
  var sum:u32=0u;
  for(var row:u32=0u;row<u.y;row++){if(textureLoad(binaryTex,vec2<i32>(i32(col),i32(row)),0).r>0.5){sum++;}}
  projection[col]=sum;
}
