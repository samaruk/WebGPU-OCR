// shaders/clustering/descriptorSimilarity.wgsl — Pairwise descriptor cosine similarity for nearby pairs

struct Uniforms {
  kp_count   : u32,
  desc_dim   : u32,
  thresh     : f32,
  max_edges  : u32,
};
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read>       descs   : array<f32>; // [kp_count * desc_dim]
@group(0) @binding(2) var<storage,read>       pairs   : array<u32>; // [N*2] candidate pairs
@group(0) @binding(3) var<storage,read>       pair_ctr: u32;
@group(0) @binding(4) var<storage,read_write> edge_ctr: atomic<u32>;
@group(0) @binding(5) var<storage,read_write> edges   : array<vec2<u32>>; // [max_edges] (a,b)

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= pair_ctr) { return; }
  let a = pairs[gid.x * 2u];
  let b = pairs[gid.x * 2u + 1u];
  let da = a * u.desc_dim;
  let db = b * u.desc_dim;
  var dot = 0.0; var na = 0.0; var nb = 0.0;
  for (var i=0u; i<u.desc_dim; i++) {
    let va = descs[da+i]; let vb = descs[db+i];
    dot += va*vb; na += va*va; nb += vb*vb;
  }
  let sim = dot / (sqrt(na)*sqrt(nb) + 1e-8);
  if (sim >= u.thresh) {
    let slot = atomicAdd(&edge_ctr, 1u);
    if (slot < u.max_edges) { edges[slot] = vec2<u32>(a, b); }
  }
}
