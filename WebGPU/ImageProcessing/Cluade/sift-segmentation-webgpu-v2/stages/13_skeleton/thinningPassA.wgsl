// thinningPassA.wgsl — Zhang-Suen sub-iteration 1 (mark pixels for removal)
struct Uni { width:u32, height:u32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u      :Uni;
@group(0) @binding(1) var<storage,read>       src    :array<u32>;
@group(0) @binding(2) var<storage,read_write> mark   :array<u32>;
@group(0) @binding(3) var<storage,read_write> changed:atomic<u32>;
fn nb(x:i32,y:i32,w:u32,h:u32)->u32{
  if(x<0||y<0||u32(x)>=w||u32(y)>=h){return 0u;}
  return src[u32(y)*w+u32(x)];
}
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let w=u.width; let h=u.height;
  if(gid.x>=w||gid.y>=h){return;}
  let idx=gid.y*w+gid.x; mark[idx]=0u;
  if(src[idx]==0u){return;}
  let x=i32(gid.x); let y=i32(gid.y);
  let p2=nb(x,y-1,w,h);let p3=nb(x+1,y-1,w,h);let p4=nb(x+1,y,w,h);let p5=nb(x+1,y+1,w,h);
  let p6=nb(x,y+1,w,h);let p7=nb(x-1,y+1,w,h);let p8=nb(x-1,y,w,h);let p9=nb(x-1,y-1,w,h);
  let B=p2+p3+p4+p5+p6+p7+p8+p9;
  if(B<2u||B>6u){return;}
  var A=0u;
  let ns=array<u32,8>(p2,p3,p4,p5,p6,p7,p8,p9);
  for(var i=0u;i<7u;i++){if(ns[i]==0u&&ns[i+1u]!=0u){A+=1u;}}
  if(ns[7u]==0u&&ns[0u]!=0u){A+=1u;}
  if(A!=1u){return;}
  if((p2*p4*p6)!=0u||(p4*p6*p8)!=0u){return;}
  mark[idx]=1u; atomicAdd(&changed,1u);
}
