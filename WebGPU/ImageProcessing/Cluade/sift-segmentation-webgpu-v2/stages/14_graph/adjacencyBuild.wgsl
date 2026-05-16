// adjacencyBuild.wgsl — build component adjacency edge list
struct Uni { width:u32, height:u32, max_edges:u32, _p:u32 };
@group(0) @binding(0) var<uniform>            u     :Uni;
@group(0) @binding(1) var<storage,read>       labels:array<u32>;
@group(0) @binding(2) var<storage,read_write> ectr  :atomic<u32>;
@group(0) @binding(3) var<storage,read_write> edges :array<vec2<u32>>;
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width-1u||gid.y>=u.height-1u){return;}
  let a=labels[gid.y*u.width+gid.x]; if(a==0u){return;}
  let br=labels[gid.y*u.width+gid.x+1u];
  let bd=labels[(gid.y+1u)*u.width+gid.x];
  if(br!=0u&&br!=a){let lo=min(a,br);let hi=max(a,br);let s=atomicAdd(&ectr,1u);if(s<u.max_edges){edges[s]=vec2<u32>(lo,hi);}}
  if(bd!=0u&&bd!=a){let lo=min(a,bd);let hi=max(a,bd);let s=atomicAdd(&ectr,1u);if(s<u.max_edges){edges[s]=vec2<u32>(lo,hi);}}
}
