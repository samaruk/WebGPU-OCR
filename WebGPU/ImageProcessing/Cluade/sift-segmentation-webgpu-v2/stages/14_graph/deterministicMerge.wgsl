// deterministicMerge.wgsl — merge high-score edges
struct Uni { edge_count:u32, thresh:f32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u      :Uni;
@group(0) @binding(1) var<storage,read>       edges  :array<vec2<u32>>;
@group(0) @binding(2) var<storage,read>       scores :array<f32>;
@group(0) @binding(3) var<storage,read_write> labels :array<u32>;
@group(0) @binding(4) var<storage,read_write> changed:atomic<u32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.edge_count||scores[gid.x]<u.thresh){return;}
  let e=edges[gid.x]; let la=labels[e.x]; let lb=labels[e.y];
  let lo=min(la,lb); let hi=max(la,lb);
  if(lo!=hi){labels[hi]=lo;atomicAdd(&changed,1u);}
}
