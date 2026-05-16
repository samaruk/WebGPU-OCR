
struct Params { rows: u32, cols: u32 }
@group(0) @binding(0) var<storage, read_write> x      : array<f32>;
@group(0) @binding(1) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let r = gid.x;
  if (r >= params.rows) { return; }
  let base = r * params.cols;
  var maxV = x[base];
  for (var c = 1u; c < params.cols; c++) { maxV = max(maxV, x[base+c]); }
  var sumE = 0.0;
  for (var c = 0u; c < params.cols; c++) { let e = exp(x[base+c]-maxV); x[base+c] = e; sumE += e; }
  for (var c = 0u; c < params.cols; c++) { x[base+c] /= sumE; }
}
