// shaders/projection_column.wgsl — Count foreground pixels per column

struct Params { width: u32, height: u32 }

@group(0) @binding(0) var morph_tex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> col_sums: array<u32>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let col = gid.x;
  if (col >= p.width) { return; }
  var count: u32 = 0u;
  for (var y: u32 = 0u; y < p.height; y++) {
    let v = textureLoad(morph_tex, vec2<i32>(i32(col), i32(y)), 0).r;
    if (v < 0.5) { count++; }
  }
  col_sums[col] = count;
}
