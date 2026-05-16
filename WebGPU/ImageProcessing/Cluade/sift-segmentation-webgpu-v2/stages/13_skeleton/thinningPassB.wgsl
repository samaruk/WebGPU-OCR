// thinningPassB.wgsl — sub-iteration 2 (different condition) + delete marked
struct Uni { width:u32, height:u32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u   :Uni;
@group(0) @binding(1) var<storage,read>       mark:array<u32>;
@group(0) @binding(2) var<storage,read_write> skel:array<u32>;
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let idx=gid.y*u.width+gid.x;
  if(mark[idx]!=0u){skel[idx]=0u;}
}
