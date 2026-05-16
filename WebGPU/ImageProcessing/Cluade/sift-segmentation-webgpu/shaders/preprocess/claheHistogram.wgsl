// shaders/preprocess/claheHistogram.wgsl — Per-tile histogram accumulation

struct Uniforms {
  width      : u32,
  height     : u32,
  tile_size  : u32,
  num_bins   : u32,
  tiles_x    : u32,
  tiles_y    : u32,
  _pad0      : u32,
  _pad1      : u32,
};

@group(0) @binding(0) var<uniform>         u       : Uniforms;
@group(0) @binding(1) var                  gray    : texture_storage_2d<r32float, read>;
@group(0) @binding(2) var<storage,read_write> hists : array<atomic<u32>>;

var<workgroup> smem : array<atomic<u32>, 256>;

@compute @workgroup_size(8,8,1)
fn main(
  @builtin(global_invocation_id) gid    : vec3<u32>,
  @builtin(local_invocation_index) lid  : u32,
  @builtin(workgroup_id)          wgid  : vec3<u32>
) {
  // Initialise workgroup histogram
  if (lid < u.num_bins) { atomicStore(&smem[lid], 0u); }
  workgroupBarrier();

  if (gid.x < u.width && gid.y < u.height) {
    let v   = textureLoad(gray, vec2<i32>(gid.xy)).r;
    let bin = u32(clamp(v * f32(u.num_bins), 0.0, f32(u.num_bins - 1u)));
    atomicAdd(&smem[bin], 1u);
  }
  workgroupBarrier();

  // Write workgroup histogram to tile slot in global buffer
  let tile_x = wgid.x;
  let tile_y = wgid.y;
  let base   = (tile_y * u.tiles_x + tile_x) * u.num_bins;
  if (lid < u.num_bins) {
    atomicAdd(&hists[base + lid], atomicLoad(&smem[lid]));
  }
}
