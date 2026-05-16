// runLengthStrokeEst.wgsl
// GPU-side run-length histogram for large images.
// Each thread scans its row and atomically updates histogram bins.
struct Params { width: u32, height: u32, _p0: u32, _p1: u32 }
@group(0) @binding(0) var binaryTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> histogram: array<atomic<u32>>; // 256 bins
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(1, 64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.y >= p.height) { return; }
  var run = 0u; var inRun = false;
  for (var x = 0u; x < p.width; x++) {
    let v = textureLoad(binaryTex, vec2<i32>(i32(x), i32(gid.y)), 0).r;
    let fg = v < 0.5;
    if (fg) { run++; inRun = true; }
    else if (inRun) {
      if (run < 64u) { atomicAdd(&histogram[run], 1u); }
      run = 0u; inRun = false;
    }
  }
}
