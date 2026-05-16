// shaders/sift/descriptorNormalize.wgsl — L2-normalise, clamp, re-normalise

struct Uniforms { kp_count:u32, mag_thr:f32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u     : Uniforms;
@group(0) @binding(1) var<storage,read_write> descs : array<f32>; // [kp_count * 128]

var<workgroup> smem : array<f32, 128>;

@compute @workgroup_size(128,1,1)
fn main(
  @builtin(workgroup_id)          wgid : vec3<u32>,
  @builtin(local_invocation_index) lid : u32
) {
  if (wgid.x >= u.kp_count) { return; }
  let base = wgid.x * 128u;
  let v    = descs[base + lid];
  smem[lid] = v * v;
  workgroupBarrier();
  // Reduce sum
  for (var s=64u; s>=1u; s>>=1u) {
    if (lid < s) { smem[lid] += smem[lid+s]; }
    workgroupBarrier();
  }
  let norm = sqrt(smem[0]) + 1e-7;
  var vn = v / norm;
  vn = min(vn, u.mag_thr);
  smem[lid] = vn * vn;
  workgroupBarrier();
  for (var s=64u; s>=1u; s>>=1u) {
    if (lid < s) { smem[lid] += smem[lid+s]; }
    workgroupBarrier();
  }
  let norm2 = sqrt(smem[0]) + 1e-7;
  descs[base + lid] = vn / norm2;
}
