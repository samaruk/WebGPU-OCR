// labelFlatten.wgsl — path compression
struct Uni { n:u32, _p0:u32, _p1:u32, _p2:u32 };
@group(0) @binding(0) var<uniform>            u :Uni;
@group(0) @binding(1) var<storage,read_write> l :array<u32>;
fn root(idx:u32)->u32{var r=idx;for(var i=0u;i<128u;i++){let p=l[r];if(p==0u||p==r+1u){break;}r=p-1u;}return r;}
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.n||l[gid.x]==0u){return;} l[gid.x]=root(gid.x)+1u;
}
