// shaders/projection.wgsl
// Compute horizontal (row) and vertical (column) projections of binary image.
// Row projection: number of foreground pixels in each row.
// Col projection: number of foreground pixels in each column.

struct Uniforms {
  width: u32,
  height: u32,
  padding0: u32,
  padding1: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var binaryTex: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> rowProjection: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> colProjection: array<atomic<u32>>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= uniforms.width || y >= uniforms.height) { return; }

  let val = textureLoad(binaryTex, vec2<i32>(i32(x), i32(y)), 0).r;
  if (val > 0.5) {
    atomicAdd(&rowProjection[y], 1u);
    atomicAdd(&colProjection[x], 1u);
  }
}
