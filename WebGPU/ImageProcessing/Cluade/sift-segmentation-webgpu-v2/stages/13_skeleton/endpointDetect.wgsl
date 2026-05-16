// endpointDetect.wgsl — skeleton endpoints (exactly 1 neighbour)
struct Uni { width:u32, height:u32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u   :Uni;
@group(0) @binding(1) var<storage,read>       skel:array<u32>;
@group(0) @binding(2) var<storage,read_write> ep  :array<u32>;
fn nb(x:i32,y:i32,w:u32,h:u32)->u32{
  if(x<0||y<0||u32(x)>=w||u32(y)>=h){return 0u;}
  return skel[u32(y)*w+u32(x)];
}
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let w=u.width; let h=u.height; let idx=gid.y*w+gid.x;
  if(gid.x>=w||gid.y>=h){return;} ep[idx]=0u;
  if(skel[idx]==0u){return;}
  let x=i32(gid.x); let y=i32(gid.y);
  let cnt=nb(x-1,y-1,w,h)+nb(x,y-1,w,h)+nb(x+1,y-1,w,h)+nb(x-1,y,w,h)+nb(x+1,y,w,h)+nb(x-1,y+1,w,h)+nb(x,y+1,w,h)+nb(x+1,y+1,w,h);
  ep[idx]=select(0u,1u,cnt==1u);
}
