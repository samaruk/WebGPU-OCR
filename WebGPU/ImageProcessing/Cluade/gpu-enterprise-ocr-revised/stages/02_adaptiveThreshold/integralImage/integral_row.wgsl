// Row-wise prefix sum (pass 1 of 2D integral image).
// Input:  rgba8unorm texture (filterable - valid for texture_2d<f32>).
// Output: array<f32> storage buffer (W*H floats, row-major).
// Each thread scans one complete row sequentially.
// All H rows execute in parallel.
// Dispatch: (1, ceil(H/256), 1)

@group(0) @binding(0) var       srcTex : texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> rowBuf : array<f32>;
@group(0) @binding(2) var<uniform> dims : vec4<u32>;

@compute @workgroup_size(1, 256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = dims.x; let H = dims.y;
  let row = gid.y;
  if (row >= H) { return; }

  var acc: f32 = 0.0;
  for (var col: u32 = 0u; col < W; col++) {
    let c = textureLoad(srcTex, vec2<i32>(i32(col), i32(row)), 0);
    acc += dot(c.rgb, vec3<f32>(0.299, 0.587, 0.114));
    rowBuf[row * W + col] = acc;
  }
}
