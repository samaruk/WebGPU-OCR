// shaders/stroke/strokeMedianReduce.wgsl — Per-component median stroke width via histogram

struct Uniforms { pixel_count:u32, max_width:u32, num_labels:u32, _pad:u32 };
@group(0) @binding(0) var<uniform>            u        : Uniforms;
@group(0) @binding(1) var<storage,read>       swt      : array<f32>;
@group(0) @binding(2) var<storage,read>       labels   : array<u32>;
@group(0) @binding(3) var<storage,read_write> hists    : array<atomic<u32>>; // [num_labels * max_width]
@group(0) @binding(4) var<storage,read_write> medians  : array<f32>;         // [num_labels]

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.pixel_count) { return; }
  let lbl = labels[gid.x];
  if (lbl == 0u) { return; }
  let bin = min(u32(swt[gid.x]), u.max_width - 1u);
  atomicAdd(&hists[lbl * u.max_width + bin], 1u);
}
