// shaders/segmentation/relabelCompact.wgsl — Remap root labels to compact range [1..N]

struct Uniforms { pixel_count:u32, max_labels:u32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u        : Uniforms;
@group(0) @binding(1) var<storage,read>       labels   : array<u32>;
@group(0) @binding(2) var<storage,read_write> remap    : array<atomic<u32>>; // [max_labels]
@group(0) @binding(3) var<storage,read_write> ctr      : atomic<u32>;
@group(0) @binding(4) var<storage,read_write> out_lbl  : array<u32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.pixel_count) { return; }
  let l = labels[gid.x];
  if (l == 0u) { out_lbl[gid.x] = 0u; return; }
  var mapped = atomicLoad(&remap[l % u.max_labels]);
  if (mapped == 0u) {
    let new_id = atomicAdd(&ctr, 1u) + 1u;
    atomicCompareExchangeWeak(&remap[l % u.max_labels], 0u, new_id);
    mapped = atomicLoad(&remap[l % u.max_labels]);
  }
  out_lbl[gid.x] = mapped;
}
