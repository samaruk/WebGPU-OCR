
struct Params { W: u32, H: u32, numRows: u32, numCols: u32 }
@group(0) @binding(0) var<storage, read>       input : array<f32>;
@group(0) @binding(1) var<storage, read>       rows  : array<u32>;
@group(0) @binding(2) var<storage, read>       cols  : array<u32>;
@group(0) @binding(3) var<storage, read_write> cells : array<f32>;
@group(0) @binding(4) var<uniform>             params: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let ci = gid.x; let ri = gid.y;
  if (ci+1u >= params.numCols || ri+1u >= params.numRows) { return; }
  let x0 = cols[ci]; let x1 = cols[ci+1u];
  let y0 = rows[ri]; let y1 = rows[ri+1u];
  var sum = 0.0; var cnt = 0.0;
  for (var y = y0; y < y1 && y < params.H; y++) {
    for (var x = x0; x < x1 && x < params.W; x++) {
      sum += input[y*params.W+x]; cnt += 1.0;
    }
  }
  let nCols = params.numCols - 1u;
  cells[ri*nCols+ci] = sum / max(cnt, 1.0);
}
