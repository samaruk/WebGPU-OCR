// shaders/common/reductions.wgsl — Workgroup reduction helpers

// Parallel prefix sum (inclusive) over shared array of size 256.
// Caller must declare: var<workgroup> smem: array<f32, 256>;
// and fill smem before calling.
fn wg_reduce_sum_f32(smem: ptr<workgroup, array<f32,256>>, lid: u32) -> f32 {
  for (var stride: u32 = 128u; stride >= 1u; stride >>= 1u) {
    workgroupBarrier();
    if (lid < stride) {
      (*smem)[lid] += (*smem)[lid + stride];
    }
  }
  workgroupBarrier();
  return (*smem)[0];
}

fn wg_reduce_max_f32(smem: ptr<workgroup, array<f32,256>>, lid: u32) -> f32 {
  for (var stride: u32 = 128u; stride >= 1u; stride >>= 1u) {
    workgroupBarrier();
    if (lid < stride) {
      (*smem)[lid] = max((*smem)[lid], (*smem)[lid + stride]);
    }
  }
  workgroupBarrier();
  return (*smem)[0];
}

fn wg_reduce_min_f32(smem: ptr<workgroup, array<f32,256>>, lid: u32) -> f32 {
  for (var stride: u32 = 128u; stride >= 1u; stride >>= 1u) {
    workgroupBarrier();
    if (lid < stride) {
      (*smem)[lid] = min((*smem)[lid], (*smem)[lid + stride]);
    }
  }
  workgroupBarrier();
  return (*smem)[0];
}
