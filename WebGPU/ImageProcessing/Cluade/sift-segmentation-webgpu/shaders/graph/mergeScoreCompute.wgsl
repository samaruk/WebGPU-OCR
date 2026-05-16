// shaders/graph/mergeScoreCompute.wgsl — Score edges for merging (shared boundary length / total perimeter)

struct Metric { area:u32, min_x:u32, min_y:u32, max_x:u32, max_y:u32, perimeter:u32, _p0:u32, _p1:u32 };
struct Uniforms { edge_count:u32, _pad0:u32, _pad1:u32, _pad2:u32 };
@group(0) @binding(0) var<uniform>            u        : Uniforms;
@group(0) @binding(1) var<storage,read>       edges    : array<vec2<u32>>;
@group(0) @binding(2) var<storage,read>       metrics  : array<Metric>;
@group(0) @binding(3) var<storage,read>       shared_boundary: array<u32>; // [edge_count]
@group(0) @binding(4) var<storage,read_write> scores   : array<f32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.edge_count) { return; }
  let e  = edges[gid.x];
  let ma = metrics[e.x]; let mb = metrics[e.y];
  let sb = f32(shared_boundary[gid.x]);
  let pa = f32(ma.perimeter); let pb = f32(mb.perimeter);
  scores[gid.x] = sb / (pa + pb - sb + 1.0);
}
