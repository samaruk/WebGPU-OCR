
// HOG: accumulate gradient magnitudes into orientation bins per cell
struct Params {
  width: u32, height: u32,
  cellSize: u32, nbins: u32,
}
@group(0) @binding(0) var<storage, read>       mag   : array<f32>;
@group(0) @binding(1) var<storage, read>       ang   : array<f32>;
@group(0) @binding(2) var<storage, read_write> hog   : array<f32>;
@group(0) @binding(3) var<uniform>             params: Params;

const TWO_PI = 6.28318530718;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let cx = gid.x; let cy = gid.y;
  let cw = params.width  / params.cellSize;
  let ch = params.height / params.cellSize;
  if (cx >= cw || cy >= ch) { return; }
  let baseOut = (cy * cw + cx) * params.nbins;

  for (var b = 0u; b < params.nbins; b++) { hog[baseOut+b] = 0.0; }

  for (var ky = 0u; ky < params.cellSize; ky++) {
    for (var kx = 0u; kx < params.cellSize; kx++) {
      let px = min(cx*params.cellSize+kx, params.width-1u);
      let py = min(cy*params.cellSize+ky, params.height-1u);
      let i  = py*params.width+px;
      let m  = mag[i];
      let a  = ang[i];
      let bin = u32(a / TWO_PI * f32(params.nbins)) % params.nbins;
      hog[baseOut+bin] += m;
    }
  }
  // Normalize cell
  var norm = 0.0;
  for (var b2 = 0u; b2 < params.nbins; b2++) { norm += hog[baseOut+b2]*hog[baseOut+b2]; }
  norm = sqrt(norm + 1e-6);
  for (var b3 = 0u; b3 < params.nbins; b3++) { hog[baseOut+b3] /= norm; }
}
