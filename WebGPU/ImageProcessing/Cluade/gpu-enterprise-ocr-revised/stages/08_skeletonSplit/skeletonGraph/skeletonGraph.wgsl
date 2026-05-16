
@group(0)@binding(0) var<storage,read> skelIn:array<u32>;
@group(0)@binding(1) var outputTex:texture_storage_2d<rgba8unorm,write>;
@group(0)@binding(2) var<uniform> u:vec4<u32>;
fn nb(x:i32,y:i32,W:i32,H:i32)->u32{
  if(x<0||y<0||x>=W||y>=H){return 0u;}
  return skelIn[u32(y)*u32(W)+u32(x)];
}
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let W=i32(u.x);let H=i32(u.y);
  if(i32(gid.x)>=W||i32(gid.y)>=H){return;}
  let x=i32(gid.x);let y=i32(gid.y);
  if(skelIn[u32(y)*u32(W)+u32(x)]==0u){
    textureStore(outputTex,vec2<i32>(gid.xy),vec4<f32>(0.,0.,0.,1.));return;
  }
  var cnt:u32=0u;
  for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){
    if(dx==0&&dy==0){continue;}cnt+=nb(x+dx,y+dy,W,H);
  }}
  var col:vec4<f32>;
  if(cnt<=1u){col=vec4<f32>(1.,.3,.3,1.);}
  else if(cnt==2u){col=vec4<f32>(.9,.9,.9,1.);}
  else{col=vec4<f32>(.2,1.,.4,1.);}
  textureStore(outputTex,vec2<i32>(gid.xy),col);
}
