// descriptorSimilarity.wgsl — cosine similarity check for candidate pairs
struct Uni { kp_count:u32, desc_dim:u32, thresh:f32, max_edges:u32 };
@group(0) @binding(0) var<uniform>            u      :Uni;
@group(0) @binding(1) var<storage,read>       descs  :array<f32>;
@group(0) @binding(2) var<storage,read>       pairs  :array<u32>;
@group(0) @binding(3) var<storage,read>       pair_n :u32;
@group(0) @binding(4) var<storage,read_write> ectr   :atomic<u32>;
@group(0) @binding(5) var<storage,read_write> edges  :array<vec2<u32>>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=pair_n){return;}
  let a=pairs[gid.x*2u]; let b=pairs[gid.x*2u+1u];
  var dot=0.0; var na=0.0; var nb_=0.0;
  for(var i=0u;i<u.desc_dim;i++){
    let va=descs[a*u.desc_dim+i]; let vb=descs[b*u.desc_dim+i];
    dot+=va*vb; na+=va*va; nb_+=vb*vb;
  }
  let sim=dot/(sqrt(na)*sqrt(nb_)+1e-8);
  if(sim>=u.thresh){
    let s=atomicAdd(&ectr,1u);
    if(s<u.max_edges){edges[s]=vec2<u32>(a,b);}
  }
}
