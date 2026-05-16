// shaders/preprocess/claheRedistribute.wgsl — Clip, redistribute, CDF, apply mapping

struct Uniforms {
  width      : u32,
  height     : u32,
  tile_size  : u32,
  num_bins   : u32,
  tiles_x    : u32,
  tiles_y    : u32,
  clip_limit : f32,
  _pad       : u32,
};

@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read_write> hists  : array<u32>;   // [tiles_y*tiles_x*num_bins]
@group(0) @binding(2) var<storage,read_write> cdfs   : array<f32>;   // [tiles_y*tiles_x*num_bins]

var<workgroup> smem  : array<f32, 256>;

@compute @workgroup_size(256,1,1)
fn main(
  @builtin(workgroup_id)          wgid : vec3<u32>,
  @builtin(local_invocation_index) lid : u32
) {
  let tile_idx = wgid.x;
  let base     = tile_idx * u.num_bins;

  // Load, clip and redistribute
  var val  = f32(hists[base + lid]);
  let clip = u.clip_limit;
  var excess = max(0.0, val - clip);
  val = min(val, clip);

  smem[lid] = excess;
  workgroupBarrier();
  // Sum all excess
  for (var s=128u; s>=1u; s>>=1u) {
    if (lid < s) { smem[lid] += smem[lid+s]; }
    workgroupBarrier();
  }
  let total_excess = smem[0];
  workgroupBarrier();

  val += total_excess / f32(u.num_bins);
  smem[lid] = val;
  workgroupBarrier();

  // Inclusive prefix sum
  for (var s=1u; s<u.num_bins; s<<=1u) {
    let v = select(0.0, smem[lid - s], lid >= s);
    workgroupBarrier();
    smem[lid] += v;
    workgroupBarrier();
  }

  let total = smem[u.num_bins - 1u];
  cdfs[base + lid] = select(0.0, smem[lid] / total, total > 0.0);
}
