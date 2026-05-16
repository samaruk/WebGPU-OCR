// shaders/stroke/strokeConsistencyMap.wgsl — Ratio of median/mean stroke widths per component

struct Uniforms { pixel_count:u32, num_labels:u32, thresh:f32, _pad:u32 };
@group(0) @binding(0) var<uniform>            u        : Uniforms;
@group(0) @binding(1) var<storage,read>       swt      : array<f32>;
@group(0) @binding(2) var<storage,read>       labels   : array<u32>;
@group(0) @binding(3) var<storage,read>       medians  : array<f32>;
@group(0) @binding(4) var<storage,read_write> consist  : array<f32>; // [pixel_count] 0/1

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.pixel_count) { return; }
  let lbl = labels[gid.x];
  if (lbl == 0u) { consist[gid.x] = 0.0; return; }
  let med = medians[lbl];
  let sw  = swt[gid.x];
  let ratio = select(sw/med, med/sw, sw > med);
  consist[gid.x] = select(0.0, 1.0, ratio >= (1.0 - u.thresh));
}
