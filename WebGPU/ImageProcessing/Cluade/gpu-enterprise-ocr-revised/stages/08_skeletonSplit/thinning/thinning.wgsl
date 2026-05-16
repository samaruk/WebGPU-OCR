
var<workgroup> sh:array<u32,256>;
@group(0)@binding(0) var<storage,read>       binaryIn :array<u32>;
@group(0)@binding(1) var<storage,read_write> binaryOut:array<u32>;
@group(0)@binding(2) var<storage,read_write> changed  :array<atomic<u32>>;
@group(0)@binding(3) var<uniform> u:vec4<u32>;
fn px(x:i32,y:i32,W:i32,H:i32)->u32{
  if(x<0||y<0||x>=W||y>=H){return 0u;}
  return binaryIn[u32(y)*u32(W)+u32(x)];
}
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let W=i32(u.x);let H=i32(u.y);
  if(i32(gid.x)>=W||i32(gid.y)>=H){return;}
  let x=i32(gid.x);let y=i32(gid.y);
  let idx=u32(y)*u32(W)+u32(x);
  binaryOut[idx]=binaryIn[idx];
  if(binaryIn[idx]==0u){return;}
  let p2=px(x,y-1,W,H);let p3=px(x+1,y-1,W,H);let p4=px(x+1,y,W,H);let p5=px(x+1,y+1,W,H);
  let p6=px(x,y+1,W,H);let p7=px(x-1,y+1,W,H);let p8=px(x-1,y,W,H);let p9=px(x-1,y-1,W,H);
  let B=p2+p3+p4+p5+p6+p7+p8+p9;
  if(B<2u||B>6u){return;}
  var A:u32=0u;
  if(p2==0u&&p3==1u){A++;}if(p3==0u&&p4==1u){A++;}if(p4==0u&&p5==1u){A++;}
  if(p5==0u&&p6==1u){A++;}if(p6==0u&&p7==1u){A++;}if(p7==0u&&p8==1u){A++;}
  if(p8==0u&&p9==1u){A++;}if(p9==0u&&p2==1u){A++;}
  if(A!=1u){return;}
  var cond:bool;
  if(u.z==0u){cond=(p2*p4*p6==0u)&&(p4*p6*p8==0u);}
  else{cond=(p2*p4*p8==0u)&&(p2*p6*p8==0u);}
  if(cond){binaryOut[idx]=0u;atomicAdd(&changed[0],1u);}
}
