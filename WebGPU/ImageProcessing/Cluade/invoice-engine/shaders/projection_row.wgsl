// shaders/projection_row.wgsl — Count foreground pixels per row

struct Params { width: u32, height: u32 }

@group(0) @binding(0) var morph_tex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> row_sums: array<u32>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let row = gid.x;
  if (row >= p.height) { return; }
  var count: u32 = 0u;
  for (var x: u32 = 0u; x < p.width; x++) {
    let v = textureLoad(morph_tex, vec2<i32>(i32(x), i32(row)), 0).r;
    if (v < 0.5) { count++; } // foreground
  }
  row_sums[row] = count;
}
