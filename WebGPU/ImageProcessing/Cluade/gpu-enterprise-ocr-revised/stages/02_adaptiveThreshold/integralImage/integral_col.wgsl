// Column-wise prefix sum (pass 2 of 2D integral image).
// Input:  array<f32> rowBuf (row-prefix sums from pass 1).
// Output: array<f32> colBuf (complete 2D integral image).
// Each thread scans one complete column sequentially.
// All W columns execute in parallel.
// Dispatch: (ceil(W/256), 1, 1)

@group(0) @binding(0) var<storage, read>       rowBuf : array<f32>;
@group(0) @binding(1) var<storage, read_write> colBuf : array<f32>;
@group(0) @binding(2) var<uniform> dims : vec4<u32>;

@compute @workgroup_size(256, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = dims.x; let H = dims.y;
  let col = gid.x;
  if (col >= W) { return; }

  var acc: f32 = 0.0;
  for (var row: u32 = 0u; row < H; row++) {
    acc += rowBuf[row * W + col];
    colBuf[row * W + col] = acc;
  }
}
