// shaders/skeleton/thinningPassA.wgsl — Zhang-Suen thinning pass A
// Marks pixels for deletion in sub-iteration 1

struct Uniforms { width:u32, height:u32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read>       src    : array<u32>;
@group(0) @binding(2) var<storage,read_write> mark   : array<u32>;
@group(0) @binding(3) var<storage,read_write> changed: atomic<u32>;

fn nb(x:i32,y:i32)->u32{
  if(x<0||y<0||u32(x)>=u.width||u32(y)>=u.height){return 0u;}
  return src[u32(y)*u.width+u32(x)];
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x>=u.width||gid.y>=u.height) { return; }
  let x=i32(gid.x); let y=i32(gid.y);
  let p = src[gid.y*u.width+gid.x];
  if (p == 0u) { mark[gid.y*u.width+gid.x] = 0u; return; }
  let p2=nb(x,y-1); let p3=nb(x+1,y-1); let p4=nb(x+1,y);
  let p5=nb(x+1,y+1); let p6=nb(x,y+1); let p7=nb(x-1,y+1);
  let p8=nb(x-1,y); let p9=nb(x-1,y-1);
  let B=p2+p3+p4+p5+p6+p7+p8+p9;
  if (B<2u||B>6u) { mark[gid.y*u.width+gid.x]=0u; return; }
  var A=0u;
  let ns=array<u32,8>(p2,p3,p4,p5,p6,p7,p8,p9);
  for (var i=0u;i<7u;i++){if(ns[i]==0u&&ns[i+1u]!=0u){A+=1u;}}
  if(ns[7u]==0u&&ns[0u]!=0u){A+=1u;}
  if(A!=1u){mark[gid.y*u.width+gid.x]=0u;return;}
  if((p2*p4*p6)!=0u||(p4*p6*p8)!=0u){mark[gid.y*u.width+gid.x]=0u;return;}
  mark[gid.y*u.width+gid.x]=1u;
  atomicAdd(&changed,1u);
}
