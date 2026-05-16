
// Softmax dust bin extraction → keypoint heatmap
struct Params { width: u32, height: u32, cellSize: u32, thresh: f32 }
@group(0) @binding(0) var<storage, read>       logits  : array<f32>;  // [H/c * W/c * 65]
@group(0) @binding(1) var<storage, read_write> heatmap : array<f32>;  // [H * W]
@group(0) @binding(2) var<uniform>             params  : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let cx = gid.x; let cy = gid.y;
  let cw = params.width  / params.cellSize;
  let ch = params.height / params.cellSize;
  if (cx >= cw || cy >= ch) { return; }

  let base = (cy * cw + cx) * 65u;
  // Softmax over 65 (8x8 + dustbin)
  var maxV = logits[base];
  for (var k = 1u; k < 65u; k++) { maxV = max(maxV, logits[base+k]); }
  var sumE = 0.0;
  for (var k2 = 0u; k2 < 65u; k2++) { sumE += exp(logits[base+k2] - maxV); }

  for (var ly = 0u; ly < params.cellSize; ly++) {
    for (var lx = 0u; lx < params.cellSize; lx++) {
      let k3 = ly * params.cellSize + lx;
      let prob = exp(logits[base+k3] - maxV) / sumE;
      let px = cx * params.cellSize + lx;
      let py = cy * params.cellSize + ly;
      if (px < params.width && py < params.height) {
        heatmap[py * params.width + px] = prob;
      }
    }
  }
}
