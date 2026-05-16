
struct Params { W: u32, H: u32, numRegions: u32 }
@group(0) @binding(0) var<storage, read>       labels  : array<u32>;
@group(0) @binding(1) var<storage, read_write> bboxes  : array<f32>;  // [N,4] x0,y0,x1,y1 (normalized)
@group(0) @binding(2) var<uniform>             params  : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.numRegions) { return; }
  var x0 = f32(params.W); var y0 = f32(params.H);
  var x1 = 0.0; var y1 = 0.0;
  let label = n + 1u;
  for (var y = 0u; y < params.H; y++) {
    for (var x = 0u; x < params.W; x++) {
      if (labels[y*params.W+x] == label) {
        x0 = min(x0, f32(x)); y0 = min(y0, f32(y));
        x1 = max(x1, f32(x)); y1 = max(y1, f32(y));
      }
    }
  }
  let W = f32(params.W); let H = f32(params.H);
  bboxes[n*4u  ] = x0 / W;
  bboxes[n*4u+1u] = y0 / H;
  bboxes[n*4u+2u] = x1 / W;
  bboxes[n*4u+3u] = y1 / H;
}
