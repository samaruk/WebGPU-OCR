// shaders/pyramid/sigmaTracking.wgsl — Write per-level sigma into uniform buffer

struct SigmaTable { values : array<f32, 64> };  // up to 4 octaves × 8 scales
@group(0) @binding(0) var<storage,read_write> table : SigmaTable;

struct Uniforms {
  octaves      : u32,
  scales       : u32,
  sigma_base   : f32,
  k            : f32,        // 2^(1/scales)
  _pad0:u32, _pad1:u32, _pad2:u32, _pad3:u32,
};
@group(0) @binding(1) var<uniform> u : Uniforms;

@compute @workgroup_size(64,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= u.octaves * u.scales) { return; }
  let o    = idx / u.scales;
  let s    = idx % u.scales;
  let sig  = u.sigma_base * pow(u.k, f32(s)) * pow(2.0, f32(o));
  table.values[idx] = sig;
}
