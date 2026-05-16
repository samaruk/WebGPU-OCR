// shaders/clustering/regionLabelPropagation.wgsl — Label propagation on keypoint graph

struct Uniforms { kp_count:u32, edge_count:u32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read>       edges   : array<vec2<u32>>;
@group(0) @binding(2) var<storage,read_write> labels  : array<u32>; // [kp_count]
@group(0) @binding(3) var<storage,read_write> changed : atomic<u32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.edge_count) { return; }
  let e  = edges[gid.x];
  let la = labels[e.x]; let lb = labels[e.y];
  if (la < lb) {
    labels[e.y] = la;
    atomicAdd(&changed, 1u);
  } else if (lb < la) {
    labels[e.x] = lb;
    atomicAdd(&changed, 1u);
  }
}
