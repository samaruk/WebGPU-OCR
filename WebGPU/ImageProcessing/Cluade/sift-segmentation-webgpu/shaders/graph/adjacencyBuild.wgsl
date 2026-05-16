// shaders/graph/adjacencyBuild.wgsl — Build component adjacency list

struct Uniforms { width:u32, height:u32, max_edges:u32, _pad:u32 };
@group(0) @binding(0) var<uniform>            u        : Uniforms;
@group(0) @binding(1) var<storage,read>       labels   : array<u32>;
@group(0) @binding(2) var<storage,read_write> edge_ctr : atomic<u32>;
@group(0) @binding(3) var<storage,read_write> edges    : array<vec2<u32>>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x>=u.width-1u||gid.y>=u.height-1u) { return; }
  let a = labels[gid.y*u.width+gid.x];
  if (a==0u) { return; }
  let nb_right = labels[gid.y*u.width+gid.x+1u];
  let nb_down  = labels[(gid.y+1u)*u.width+gid.x];
  if (nb_right!=0u&&nb_right!=a) {
    let lo=min(a,nb_right); let hi=max(a,nb_right);
    let s=atomicAdd(&edge_ctr,1u);
    if(s<u.max_edges){edges[s]=vec2<u32>(lo,hi);}
  }
  if (nb_down!=0u&&nb_down!=a) {
    let lo=min(a,nb_down); let hi=max(a,nb_down);
    let s=atomicAdd(&edge_ctr,1u);
    if(s<u.max_edges){edges[s]=vec2<u32>(lo,hi);}
  }
}
