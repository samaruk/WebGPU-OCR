// shaders/graph/deterministicMerge.wgsl — Merge edges above threshold deterministically

struct Uniforms { edge_count:u32, thresh:f32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read>       edges   : array<vec2<u32>>;
@group(0) @binding(2) var<storage,read>       scores  : array<f32>;
@group(0) @binding(3) var<storage,read_write> labels  : array<u32>;
@group(0) @binding(4) var<storage,read_write> changed : atomic<u32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.edge_count) { return; }
  if (scores[gid.x] < u.thresh) { return; }
  let e = edges[gid.x];
  let a = e.x; let b = e.y;
  // Point higher label's root to lower label
  let lo = min(labels[a], labels[b]);
  let hi = max(labels[a], labels[b]);
  if (lo != hi) {
    labels[hi] = lo;
    atomicAdd(&changed, 1u);
  }
}
