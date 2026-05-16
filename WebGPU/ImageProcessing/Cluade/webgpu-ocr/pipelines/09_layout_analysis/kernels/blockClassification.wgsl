
// Classify each block as text/heading/table/figure by density
struct Params { nBlocks: u32, featDim: u32 }
@group(0) @binding(0) var<storage, read>       blockFeat : array<f32>;  // [N, D]
@group(0) @binding(1) var<storage, read_write> blockClass: array<u32>;  // [N]
@group(0) @binding(2) var<uniform>             params    : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.nBlocks) { return; }
  let density = blockFeat[n * params.featDim];
  var cls = 0u;
  if (density > 0.7) { cls = 1u; }       // heading
  else if (density > 0.4) { cls = 0u; }  // text
  else if (density > 0.2) { cls = 3u; }  // figure
  else { cls = 2u; }                      // table
  blockClass[n] = cls;
}
