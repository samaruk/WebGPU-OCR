// shaders/skeleton/endpointDetect.wgsl — Detect skeleton endpoints (exactly 1 neighbour)

struct Uniforms { width:u32, height:u32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u        : Uniforms;
@group(0) @binding(1) var<storage,read>       skel     : array<u32>;
@group(0) @binding(2) var<storage,read_write> endpoints: array<u32>;

fn nb(x:i32,y:i32)->u32{
  if(x<0||y<0||u32(x)>=u.width||u32(y)>=u.height){return 0u;}
  return skel[u32(y)*u.width+u32(x)];
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x>=u.width||gid.y>=u.height) { return; }
  let idx=gid.y*u.width+gid.x;
  if (skel[idx]==0u) { endpoints[idx]=0u; return; }
  let x=i32(gid.x); let y=i32(gid.y);
  let cnt = nb(x-1,y-1)+nb(x,y-1)+nb(x+1,y-1)
           +nb(x-1,y)             +nb(x+1,y)
           +nb(x-1,y+1)+nb(x,y+1)+nb(x+1,y+1);
  endpoints[idx] = select(0u, 1u, cnt == 1u);
}
