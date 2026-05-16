
@group(0) @binding(0) var<storage,read>       labelsIn :array<u32>;
@group(0) @binding(1) var<storage,read_write> labelsOut:array<u32>;
@group(0) @binding(2) var binaryTex:texture_2d<f32>;
@group(0) @binding(3) var<uniform> u:vec4<u32>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let W=u.x;let H=u.y;if(gid.x>=W||gid.y>=H){return;}
  let idx=gid.y*W+gid.x;
  if(textureLoad(binaryTex,vec2<i32>(gid.xy),0).r<0.5){labelsOut[idx]=0u;return;}
  let cur=labelsIn[idx];if(cur!=0u){labelsOut[idx]=cur;return;}
  let x=i32(gid.x);let y=i32(gid.y);var best:u32=0u;
  let offs=array<vec2<i32>,4>(vec2<i32>(1,0),vec2<i32>(-1,0),vec2<i32>(0,1),vec2<i32>(0,-1));
  for(var k=0;k<4;k++){
    let nx=x+offs[k].x;let ny=y+offs[k].y;
    if(nx<0||ny<0||nx>=i32(W)||ny>=i32(H)){continue;}
    let nl=labelsIn[u32(ny)*W+u32(nx)];if(nl!=0u){best=nl;break;}
  }
  labelsOut[idx]=best;
}
